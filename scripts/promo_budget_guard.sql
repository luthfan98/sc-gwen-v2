-- Guard promo budget: auto stop when usage reaches or exceeds threshold.
-- Target DB: db_gwen_v2

USE [db_gwen_v2];
GO

CREATE OR ALTER PROCEDURE dbo.GWEN_StopPromoOverBudget
  @near_threshold DECIMAL(5, 2) = 90
AS
BEGIN
  SET NOCOUNT ON;

  IF OBJECT_ID('tempdb..#stopped') IS NOT NULL DROP TABLE #stopped;

  ;WITH usage AS (
    SELECT
      LTRIM(RTRIM(promo_code)) AS promo_code,
      SUM(CAST(ISNULL(discount, 0) AS DECIMAL(18, 2))) AS total_discount
    FROM dbo.pos_transaction_item_promos_central
    WHERE ISNULL(is_active, 1) = 1
    GROUP BY LTRIM(RTRIM(promo_code))
  ),
  candidates AS (
    SELECT
      p.kode_t_promosi,
      p.budget_total,
      u.total_discount,
      CASE
        WHEN p.budget_total > 0 THEN (u.total_discount / NULLIF(p.budget_total, 0)) * 100
        ELSE 0
      END AS pct
    FROM dbo.GWEN_t_promosi p
    JOIN usage u ON u.promo_code = p.kode_t_promosi
    WHERE ISNULL(p.status_approval, 0) = 1
      AND ISNULL(p.status_aktif, 0) = 1
      AND p.budget_total IS NOT NULL
      AND p.budget_total > 0
      AND CONVERT(date, GETDATE()) BETWEEN CONVERT(date, p.valid_from) AND CONVERT(date, p.valid_to)
      AND (
        p.time_from IS NULL
        OR p.time_to IS NULL
        OR CONVERT(time, GETDATE()) BETWEEN CONVERT(time, p.time_from) AND CONVERT(time, p.time_to)
      )
  )
  SELECT
    c.kode_t_promosi,
    c.total_discount,
    c.pct
  INTO #stopped
  FROM candidates c
  WHERE c.pct >= @near_threshold;

  IF EXISTS (SELECT 1 FROM #stopped)
  BEGIN
    UPDATE p
    SET
      status_aktif = 0,
      budget_terpakai = s.total_discount,
      updated_by = 'SYSTEM_BUDGET',
      updated_at = GETDATE()
    FROM dbo.GWEN_t_promosi p
    JOIN #stopped s ON s.kode_t_promosi = p.kode_t_promosi;

    DECLARE @srv SYSNAME;
    DECLARE @db SYSNAME;
    DECLARE @kasirNo VARCHAR(20);
    DECLARE @sql NVARCHAR(MAX);

    DECLARE srv_cursor CURSOR LOCAL FAST_FORWARD FOR
      SELECT name
      FROM sys.servers
      WHERE is_linked = 1 AND name LIKE 'KASIR%';

    OPEN srv_cursor;
    FETCH NEXT FROM srv_cursor INTO @srv;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      SET @kasirNo = '';
      IF PATINDEX('%[0-9]%', @srv) > 0
        SET @kasirNo = SUBSTRING(@srv, PATINDEX('%[0-9]%', @srv), 20);

      SET @db = CASE
        WHEN @kasirNo IS NOT NULL AND LTRIM(RTRIM(@kasirNo)) <> '' THEN CONCAT('db_gwen_kasir', @kasirNo)
        ELSE 'db_gwen_kasir'
      END;

      SET @sql = N'
        IF EXISTS (SELECT 1 FROM [' + @srv + '].master.sys.databases WHERE name = @db)
        BEGIN
          UPDATE t
          SET
            status_aktif = 0,
            budget_terpakai = s.total_discount,
            updated_by = ''SYSTEM_BUDGET'',
            updated_at = GETDATE()
          FROM [' + @srv + '].[' + @db + '].dbo.GWEN_t_promosi t
          JOIN #stopped s ON s.kode_t_promosi = t.kode_t_promosi;
        END;';
      EXEC sp_executesql @sql, N'@db sysname', @db = @db;

      FETCH NEXT FROM srv_cursor INTO @srv;
    END
    CLOSE srv_cursor;
    DEALLOCATE srv_cursor;
  END
END;
GO

USE [msdb];
GO

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'GWEN_PromoBudget_Stop')
  EXEC msdb.dbo.sp_delete_job @job_name = N'GWEN_PromoBudget_Stop';

IF EXISTS (SELECT 1 FROM msdb.dbo.sysschedules WHERE name = N'GWEN_PromoBudget_Stop_Every5Min')
  EXEC msdb.dbo.sp_delete_schedule @schedule_name = N'GWEN_PromoBudget_Stop_Every5Min';

EXEC msdb.dbo.sp_add_job
  @job_name = N'GWEN_PromoBudget_Stop',
  @enabled = 1,
  @description = N'Auto stop promo when budget usage reaches/exceeds threshold.',
  @start_step_id = 1;

EXEC msdb.dbo.sp_add_jobstep
  @job_name = N'GWEN_PromoBudget_Stop',
  @step_name = N'Stop promo over budget',
  @subsystem = N'TSQL',
  @database_name = N'db_gwen_v2',
  @command = N'EXEC dbo.GWEN_StopPromoOverBudget @near_threshold = 90;';

EXEC msdb.dbo.sp_add_schedule
  @schedule_name = N'GWEN_PromoBudget_Stop_Every5Min',
  @enabled = 1,
  @freq_type = 4, -- daily
  @freq_interval = 1,
  @freq_subday_type = 4, -- minutes
  @freq_subday_interval = 5,
  @active_start_time = 0;

EXEC msdb.dbo.sp_attach_schedule
  @job_name = N'GWEN_PromoBudget_Stop',
  @schedule_name = N'GWEN_PromoBudget_Stop_Every5Min';

EXEC msdb.dbo.sp_add_jobserver
  @job_name = N'GWEN_PromoBudget_Stop';
GO
