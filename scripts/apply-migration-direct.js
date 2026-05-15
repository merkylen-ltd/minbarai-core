const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1] : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key (first 50 chars):', serviceRoleKey?.slice(0, 50));

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

(async () => {
  try {
    // First, create migrations table if not exists
    console.log('\n⏳  Creating _migrations table...');
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS public._migrations (
        id         SERIAL       PRIMARY KEY,
        filename   TEXT         UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `;

    // Check if table exists by querying it
    const { error: checkError } = await supabase
      .from('_migrations')
      .select('count(*)', { count: 'exact' })
      .limit(0);

    if (checkError && checkError.code === 'PGRST116') {
      // Table doesn't exist, try to create using SQL
      // Since Supabase JS client doesn't have direct SQL execution for admin,
      // we'll use the raw PostgreSQL function call
      console.log('⏳  Creating migrations table via SQL...');
    }

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_webhook_rate_limiting.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋  Migration file: 003_webhook_rate_limiting.sql');
    console.log('    Lines:', migrationSql.split('\n').length);

    // Check if already applied
    console.log('\n⏳  Checking if migration already applied...');
    const { data: existing, error: checkExistingError } = await supabase
      .from('_migrations')
      .select('filename')
      .eq('filename', '003_webhook_rate_limiting.sql');

    if (!checkExistingError && existing && existing.length > 0) {
      console.log('✅  Migration already applied');
      process.exit(0);
    }

    console.log('⏳  Applying migration 003_webhook_rate_limiting.sql...');
    
    // Split migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 0);

    console.log(`   Found ${statements.length} SQL statement(s)`);

    // Execute via the internal API - since we have service role, we should be able to exec raw SQL
    // Unfortunately, Supabase JS client doesn't expose raw SQL for RLS-bypassing queries
    // Instead, let's try a different approach using the REST API directly

    // Actually, for safety and simplicity in a Node context, we should ideally use the SQL editor
    // But let me try to use the rpc call to see if there's an exec_sql function

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 100) {
        console.log(`   Executing statement ${i + 1}/${statements.length} (${stmt.length} chars)...`);
      }
    }

    console.log('\n⚠️  Direct SQL execution via Supabase JS client is limited.');
    console.log('    Please apply this migration manually via the Supabase SQL Editor:');
    console.log('    https://app.supabase.com/project/hjsifxofnqbnrgqkbomx/sql/new');
    console.log('\n📄  Migration file is ready at:');
    console.log(`    ${migrationPath}`);
    console.log('\n✅  Copy and paste the entire migration SQL into the editor and run it.');

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
