-- ==============================================================================
-- StarRuby.in Banking ERP — Allow Standalone Documents in Cloudflare R2 Storage
-- Allows general files (receipts, statements, invoices, storage sync) without requiring transaction links
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_belongs_to' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents DROP CONSTRAINT chk_belongs_to;
    END IF;
END $$;
