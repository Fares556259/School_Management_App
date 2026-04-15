import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

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
    if (error.message.includes('not found')) {
      console.error('❌ Bucket "uploads" NOT FOUND. Please create it in your Supabase dashboard.')
    } else {
      console.error('❌ Error checking bucket:', error.message)
    }
  } else {
    console.log('✅ Bucket "uploads" exists.')
    console.log('Bucket data:', data)
  }
}

checkBucket()
