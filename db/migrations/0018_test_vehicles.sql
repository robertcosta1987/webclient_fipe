-- 0018_test_vehicles.sql — vehicles registered on the "Teste Auto Preenchimento"
-- page (plate → FIPE auto-fill → save). Owned per user. Idempotent.

IF OBJECT_ID('test_vehicles', 'U') IS NULL
CREATE TABLE test_vehicles (
  id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_test_vehicles PRIMARY KEY DEFAULT NEWID(),
  owner_id               UNIQUEIDENTIFIER NULL,
  placa                  NVARCHAR(10)  NULL,
  marca                  NVARCHAR(120) NULL,
  modelo                 NVARCHAR(160) NULL,
  versao                 NVARCHAR(200) NULL,
  ano_modelo             NVARCHAR(10)  NULL,
  ano_fabricacao         NVARCHAR(10)  NULL,
  chassi                 NVARCHAR(40)  NULL,
  num_motor              NVARCHAR(40)  NULL,
  combustivel            NVARCHAR(60)  NULL,
  cor_veiculo            NVARCHAR(40)  NULL,
  tipo_veiculo           NVARCHAR(60)  NULL,
  especie_veiculo        NVARCHAR(60)  NULL,
  nacional               NVARCHAR(30)  NULL,
  potencia               NVARCHAR(20)  NULL,
  cilindradas            NVARCHAR(20)  NULL,
  eixos                  NVARCHAR(10)  NULL,
  cap_max_tracao         NVARCHAR(20)  NULL,
  capacidade_passageiro  NVARCHAR(10)  NULL,
  caixa_cambio           NVARCHAR(60)  NULL,
  num_carroceria         NVARCHAR(60)  NULL,
  codigo_fipe            NVARCHAR(20)  NULL,
  fipe_id                NVARCHAR(20)  NULL,
  versao_fipe            NVARCHAR(200) NULL,
  valor_atual            DECIMAL(14,2) NULL,
  photo_count            INT           NOT NULL DEFAULT 0,
  created_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_test_vehicles_owner')
  CREATE INDEX IX_test_vehicles_owner ON test_vehicles(owner_id, updated_at DESC);
GO
