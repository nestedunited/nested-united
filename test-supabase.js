// Test Supabase connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mmhgljkwbtnlygwkgqyi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1taGdsamt3YnRubHlnd2tncXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5Mzc5MTksImV4cCI6MjA4MDUxMzkxOX0.kQdElnan75i6XP8Ll5OyLEixsP0tqE_i_EpuYdRV4-I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing Supabase connection...\n');
  
  // Test 1: Check if we can connect
  const { data: testData, error: testError } = await supabase
    .from('users')
    .select('count')
    .limit(1);
  
  if (testError) {
    console.log('❌ Connection Error:', testError.message);
    return;
  }
  console.log('✅ Connected to Supabase!\n');
  
  // Test 2: Try to sign in
  console.log('Testing sign in with: elsamahy771@gmail.com');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'elsamahy771@gmail.com',
    password: 'Test123456!', // استخدم الباسورد الصحيح
  });
  
  if (error) {
    console.log('❌ Sign in error:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('✅ Sign in successful!');
    console.log('User:', data.user);
  }
  
  // Test 3: Check users table
  console.log('\nChecking users table...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'elsamahy771@gmail.com');
  
  if (usersError) {
    console.log('❌ Error reading users table:', usersError.message);
  } else {
    console.log('✅ User in users table:', users);
  }
}

test();

