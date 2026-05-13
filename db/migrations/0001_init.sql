-- 0001_init.sql — bootstrap the carros_ativos table for the CRM demo.
-- Idempotent (guards on object existence) so re-running is safe during dev.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'carros_ativos')
BEGIN
  CREATE TABLE carros_ativos (
    id                                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    placa                             NVARCHAR(10)    NOT NULL UNIQUE,
    chassi                            NVARCHAR(20),
    modelo                            NVARCHAR(200),
    ano_fabricacao                    INT,
    ano_modelo                        INT,
    cor                               NVARCHAR(50),
    combustivel                       NVARCHAR(50),
    uf                                NVARCHAR(2),
    municipio                         NVARCHAR(100),
    tipo_veiculo                      NVARCHAR(50),
    motor                             NVARCHAR(50),
    numero_caixa_cambio               NVARCHAR(50),
    numero_eixo_traseiro_diferencial  NVARCHAR(50),
    procedencia                       NVARCHAR(20),
    situacao_chassi                   NVARCHAR(20),
    capacidade_de_carga               NVARCHAR(20),
    potencia                          NVARCHAR(20),
    numero_cilindradas                NVARCHAR(20),
    capacidade_de_passageiros         NVARCHAR(10),
    tipo_montagem                     NVARCHAR(20),
    quantidade_de_eixos               NVARCHAR(10),
    carroceria                        NVARCHAR(50),
    codigo_fipe                       NVARCHAR(20),
    descricao_fipe                    NVARCHAR(300),
    valor_fipe                        DECIMAL(12,2),
    criado_em                         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    atualizado_em                     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_carros_ativos_modelo'    AND object_id = OBJECT_ID('carros_ativos'))
  CREATE INDEX ix_carros_ativos_modelo      ON carros_ativos(modelo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_carros_ativos_municipio' AND object_id = OBJECT_ID('carros_ativos'))
  CREATE INDEX ix_carros_ativos_municipio   ON carros_ativos(municipio);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_carros_ativos_uf'        AND object_id = OBJECT_ID('carros_ativos'))
  CREATE INDEX ix_carros_ativos_uf          ON carros_ativos(uf);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_carros_ativos_codigo_fipe' AND object_id = OBJECT_ID('carros_ativos'))
  CREATE INDEX ix_carros_ativos_codigo_fipe ON carros_ativos(codigo_fipe);
GO

IF NOT EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_carros_ativos_updated')
BEGIN
  EXEC('CREATE TRIGGER trg_carros_ativos_updated
        ON carros_ativos AFTER UPDATE AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE c SET atualizado_em = SYSUTCDATETIME()
          FROM carros_ativos c INNER JOIN inserted i ON c.id = i.id;
        END');
END;
GO
