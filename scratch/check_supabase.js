const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBucket() {
  console.log('Checking bucket "uploads"...')
  const { data, error } = await supabase.storage.getBucket('uploads')
  
  if (error) {
    console.error('❌ Bucket "uploads" check failed:', error.message)
    console.log('Hint: Ensure the bucket exists and is set to PUBLIC.')
  } else {
    console.log('✅ Bucket "uploads" exists.')
    console.log('Bucket data:', data)
  }
}

checkBucket()
