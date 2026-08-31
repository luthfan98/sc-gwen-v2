/* Harga event berperiode. Jalankan di database pusat db_gwen_v2. */
IF OBJECT_ID('dbo.GWEN_t_harga_event', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GWEN_t_harga_event (
    kode_t_harga_event VARCHAR(50) NOT NULL CONSTRAINT PK_GWEN_t_harga_event PRIMARY KEY,
    nama_event VARCHAR(200) NOT NULL,
    berlaku_mulai DATETIME2 NOT NULL,
    berlaku_sampai DATETIME2 NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_GWEN_t_harga_event_status DEFAULT 'SCHEDULED',
    created_by VARCHAR(100) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_GWEN_t_harga_event_created_at DEFAULT SYSUTCDATETIME(),
    updated_by VARCHAR(100) NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_GWEN_t_harga_event_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_GWEN_t_harga_event_period CHECK (berlaku_sampai > berlaku_mulai),
    CONSTRAINT CK_GWEN_t_harga_event_status CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED'))
  );
END;
GO

IF OBJECT_ID('dbo.GWEN_d_harga_event_variant', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GWEN_d_harga_event_variant (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GWEN_d_harga_event_variant PRIMARY KEY,
    kode_t_harga_event VARCHAR(50) NOT NULL,
    kode_barang_variant VARCHAR(50) NOT NULL,
    id_kelas_harga INT NOT NULL,
    kode_mn_harga_jual VARCHAR(50) NULL,
    harga_normal_1 DECIMAL(20,2) NULL,
    harga_normal_3 DECIMAL(20,2) NULL,
    harga_normal_6 DECIMAL(20,2) NULL,
    harga_normal_12 DECIMAL(20,2) NULL,
    harga_event_1 DECIMAL(20,2) NULL,
    harga_event_3 DECIMAL(20,2) NULL,
    harga_event_6 DECIMAL(20,2) NULL,
    harga_event_12 DECIMAL(20,2) NULL,
    applied BIT NOT NULL CONSTRAINT DF_GWEN_d_harga_event_variant_applied DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_GWEN_d_harga_event_variant_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_GWEN_d_harga_event_variant_header FOREIGN KEY (kode_t_harga_event)
      REFERENCES dbo.GWEN_t_harga_event(kode_t_harga_event),
    CONSTRAINT UQ_GWEN_d_harga_event_variant UNIQUE (kode_t_harga_event, kode_barang_variant, id_kelas_harga)
  );
END;
GO

IF OBJECT_ID('dbo.sp_apply_harga_event', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_apply_harga_event;
GO
CREATE PROCEDURE dbo.sp_apply_harga_event
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @now DATETIME2 = SYSUTCDATETIME();

  BEGIN TRANSACTION;
  BEGIN TRY
    UPDATE d
    SET d.harga_1 = e.harga_event_1,
        d.harga_3 = e.harga_event_3,
        d.harga_6 = e.harga_event_6,
        d.harga_12 = e.harga_event_12,
        d.updated_by = 'SQL_AGENT_EVENT',
        d.updated_at = @now
    FROM dbo.GWEN_mn_barang_harga_jual_variant d
    JOIN dbo.GWEN_d_harga_event_variant e
      ON e.kode_mn_harga_jual = d.kode_mn_harga_jual
    JOIN dbo.GWEN_t_harga_event h
      ON h.kode_t_harga_event = e.kode_t_harga_event
    WHERE h.status IN ('DRAFT','SCHEDULED')
      AND h.berlaku_mulai <= @now
      AND h.berlaku_sampai > @now
      AND e.applied = 0;

    UPDATE e SET e.applied = 1
    FROM dbo.GWEN_d_harga_event_variant e
    JOIN dbo.GWEN_t_harga_event h ON h.kode_t_harga_event = e.kode_t_harga_event
    WHERE h.status IN ('DRAFT','SCHEDULED')
      AND h.berlaku_mulai <= @now
      AND h.berlaku_sampai > @now
      AND e.applied = 0;

    UPDATE dbo.GWEN_t_harga_event
    SET status = 'ACTIVE', updated_at = @now, updated_by = 'SQL_AGENT_EVENT'
    WHERE status IN ('DRAFT','SCHEDULED') AND berlaku_mulai <= @now AND berlaku_sampai > @now;

    UPDATE d
    SET d.harga_1 = e.harga_normal_1,
        d.harga_3 = e.harga_normal_3,
        d.harga_6 = e.harga_normal_6,
        d.harga_12 = e.harga_normal_12,
        d.updated_by = 'SQL_AGENT_EVENT',
        d.updated_at = @now
    FROM dbo.GWEN_mn_barang_harga_jual_variant d
    JOIN dbo.GWEN_d_harga_event_variant e ON e.kode_mn_harga_jual = d.kode_mn_harga_jual
    JOIN dbo.GWEN_t_harga_event h ON h.kode_t_harga_event = e.kode_t_harga_event
    WHERE h.status = 'ACTIVE' AND h.berlaku_sampai <= @now AND e.applied = 1;

    UPDATE e SET e.applied = 0
    FROM dbo.GWEN_d_harga_event_variant e
    JOIN dbo.GWEN_t_harga_event h ON h.kode_t_harga_event = e.kode_t_harga_event
    WHERE h.status = 'ACTIVE' AND h.berlaku_sampai <= @now AND e.applied = 1;

    UPDATE dbo.GWEN_t_harga_event
    SET status = 'COMPLETED', updated_at = @now, updated_by = 'SQL_AGENT_EVENT'
    WHERE status = 'ACTIVE' AND berlaku_sampai <= @now;

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
GO

/* SQL Server Agent job, aman dijalankan ulang karena mengecek nama job terlebih dahulu. */
IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'GWEN - Apply Harga Event')
BEGIN
  DECLARE @jobId UNIQUEIDENTIFIER;
  DECLARE @activeStartDate INT = CONVERT(INT, CONVERT(VARCHAR(8), GETDATE(), 112));
  DECLARE @databaseName SYSNAME = DB_NAME();
  EXEC msdb.dbo.sp_add_job @job_name = N'GWEN - Apply Harga Event', @enabled = 1,
    @description = N'Mengaktifkan dan mengembalikan harga event berdasarkan periode.', @job_id = @jobId OUTPUT;
  EXEC msdb.dbo.sp_add_jobstep @job_id = @jobId, @step_name = N'Apply harga event',
    @subsystem = N'TSQL', @database_name = @databaseName, @command = N'EXEC dbo.sp_apply_harga_event;';
  EXEC msdb.dbo.sp_add_schedule @schedule_name = N'GWEN - Every 1 Minute', @enabled = 1,
    @freq_type = 4, @freq_interval = 1, @freq_subday_type = 4, @freq_subday_interval = 1,
    @active_start_date = @activeStartDate;
  EXEC msdb.dbo.sp_attach_schedule @job_id = @jobId, @schedule_name = N'GWEN - Every 1 Minute';
  EXEC msdb.dbo.sp_add_jobserver @job_id = @jobId;
END;
GO
