import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_: any, context: any) {
  try {
    const caseId = context?.params?.caseId

    // Fetch business case with error handling
    const { data: caseData, error: caseError } = await supabase
      .from('business_cases')
      .select('*')
      .eq('id', caseId)
      .single()

    if (caseError) {
      console.error('Error fetching case:', caseError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch case data' }),
        { status: 500 }
      )
    }

    if (!caseData) {
      return new Response(
        JSON.stringify({ error: 'Case not found' }),
        { status: 404 }
      )
    }

    // Fetch case sections with error handling
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('case_sections')
      .select('*')
      .eq('case_id', caseId)
      .order('order_index', { ascending: true })

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch case sections' }),
        { status: 500 }
      )
    }

    return new Response(
      JSON.stringify({
        case: caseData,
        sections: sectionsData || []
      })
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500 }
    )
  }
} 