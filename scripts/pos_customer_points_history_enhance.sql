SET NOCOUNT ON;

IF COL_LENGTH('dbo.pos_customers', 'total_points') IS NULL
BEGIN
  ALTER TABLE dbo.pos_customers ADD total_points int NULL;
END;

EXEC sp_executesql N'
UPDATE dbo.pos_customers
SET total_points = COALESCE(total_points, 0)
WHERE total_points IS NULL;
';

IF OBJECT_ID('dbo.pos_customer_points_history', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_customer_points_history (
    id int IDENTITY(1,1) NOT NULL,
    central_trx_code nvarchar(60) NOT NULL,
    source_trx_code nvarchar(100) NOT NULL,
    source_kasir nvarchar(40) NOT NULL,
    source_db nvarchar(260) NOT NULL,
    customer_id int NULL,
    customer_name nvarchar(255) NULL,
    customer_phone nvarchar(50) NULL,
    transaction_subtotal decimal(18,2) NULL,
    points_earned int NOT NULL,
    rule_note nvarchar(255) NULL,
    created_at datetime2 NULL,
    points_before int NULL,
    points_change int NULL,
    points_after int NULL,
    CONSTRAINT PK_pos_customer_points_history PRIMARY KEY CLUSTERED (id)
  );
END;

IF COL_LENGTH('dbo.pos_customer_points_history', 'points_before') IS NULL
BEGIN
  ALTER TABLE dbo.pos_customer_points_history ADD points_before int NULL;
END;

IF COL_LENGTH('dbo.pos_customer_points_history', 'points_change') IS NULL
BEGIN
  ALTER TABLE dbo.pos_customer_points_history ADD points_change int NULL;
END;

IF COL_LENGTH('dbo.pos_customer_points_history', 'points_after') IS NULL
BEGIN
  ALTER TABLE dbo.pos_customer_points_history ADD points_after int NULL;
END;

DECLARE @cancelExprHistory nvarchar(max) = N'0=1';
DECLARE @cancelExprInserted nvarchar(max) = N'0=1';

IF OBJECT_ID('dbo.pos_transactions_canceled') IS NOT NULL
BEGIN
  SET @cancelExprHistory = N'EXISTS (SELECT 1 FROM dbo.pos_transactions_canceled c WHERE c.source_trx_code = h.source_trx_code)';
  SET @cancelExprInserted = N'EXISTS (SELECT 1 FROM dbo.pos_transactions_canceled c WHERE c.source_trx_code = i.source_trx_code)';
END
ELSE IF OBJECT_ID('dbo.pos_transaction_cancels') IS NOT NULL
BEGIN
  SET @cancelExprHistory = N'EXISTS (SELECT 1 FROM dbo.pos_transaction_cancels c WHERE c.trx_code = h.source_trx_code)';
  SET @cancelExprInserted = N'EXISTS (SELECT 1 FROM dbo.pos_transaction_cancels c WHERE c.trx_code = i.source_trx_code)';
END;

DECLARE @sqlBackfill nvarchar(max) = N'
IF EXISTS (
      SELECT 1
      FROM dbo.pos_customer_points_history
      WHERE points_before IS NULL
         OR points_change IS NULL
         OR points_after IS NULL
    )
BEGIN
  ;WITH src AS (
    SELECT h.*,
      CASE
        WHEN h.points_earned IS NULL THEN 0
        WHEN h.points_earned < 0 THEN h.points_earned
        WHEN ' + @cancelExprHistory + N' THEN -ABS(h.points_earned)
        ELSE h.points_earned
      END AS delta
    FROM dbo.pos_customer_points_history h
  ),
  calc AS (
    SELECT s.id,
           s.customer_id,
           s.delta,
           SUM(s.delta) OVER (
             PARTITION BY s.customer_id
             ORDER BY s.created_at, s.id
             ROWS UNBOUNDED PRECEDING
           ) AS cum_delta
    FROM src s
  )
  UPDATE h
  SET points_change = c.delta,
      points_before = CASE
        WHEN c.customer_id IS NULL THEN NULL
        ELSE c.cum_delta - c.delta
      END,
      points_after = CASE
        WHEN c.customer_id IS NULL THEN NULL
        ELSE c.cum_delta
      END
  FROM dbo.pos_customer_points_history h
  JOIN calc c ON h.id = c.id;

END;

;WITH src2 AS (
  SELECT h.customer_id,
    CASE
      WHEN h.points_earned IS NULL THEN 0
      WHEN h.points_earned < 0 THEN h.points_earned
      WHEN ' + @cancelExprHistory + N' THEN -ABS(h.points_earned)
      ELSE h.points_earned
    END AS delta
  FROM dbo.pos_customer_points_history h
  WHERE h.customer_id IS NOT NULL
),
agg AS (
  SELECT customer_id, SUM(delta) AS total_points
  FROM src2
  GROUP BY customer_id
)
UPDATE pc
SET total_points = COALESCE(agg.total_points, 0)
FROM dbo.pos_customers pc
LEFT JOIN agg ON pc.id = agg.customer_id;
';
EXEC sp_executesql @sqlBackfill;

DECLARE @sqlTrigger nvarchar(max) = N'
CREATE OR ALTER TRIGGER dbo.trg_pos_customer_points_history_ai
ON dbo.pos_customer_points_history
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH ins AS (
    SELECT i.*,
      COALESCE(
        i.points_change,
        CASE
          WHEN i.points_earned IS NULL THEN 0
          WHEN i.points_earned < 0 THEN i.points_earned
          WHEN ' + @cancelExprInserted + N' THEN -ABS(i.points_earned)
          ELSE i.points_earned
        END
      ) AS delta
    FROM inserted i
  ),
  base AS (
    SELECT ins.*,
      COALESCE(pc.total_points, 0) AS base_points
    FROM ins
    LEFT JOIN dbo.pos_customers pc ON pc.id = ins.customer_id
  ),
  calc AS (
    SELECT *,
      SUM(delta) OVER (
        PARTITION BY customer_id
        ORDER BY created_at, id
        ROWS UNBOUNDED PRECEDING
      ) AS cum_delta
    FROM base
  )
  UPDATE h
  SET points_change = c.delta,
      points_before = CASE
        WHEN c.customer_id IS NULL THEN NULL
        ELSE c.base_points + c.cum_delta - c.delta
      END,
      points_after = CASE
        WHEN c.customer_id IS NULL THEN NULL
        ELSE c.base_points + c.cum_delta
      END
  FROM dbo.pos_customer_points_history h
  JOIN calc c ON h.id = c.id;

  ;WITH upd AS (
    SELECT customer_id, SUM(delta) AS delta
    FROM calc
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
  )
  UPDATE pc
  SET total_points = COALESCE(pc.total_points, 0) + upd.delta
  FROM dbo.pos_customers pc
  JOIN upd ON pc.id = upd.customer_id;
END;
';
EXEC sp_executesql @sqlTrigger;
