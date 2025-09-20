import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jrmetgwcibkyyveqvwun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybWV0Z3djaWJreXl2ZXF2d3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjkyMzAsImV4cCI6MjA3MjY0NTIzMH0.NbsHWVgXMNvLU4w6NfPjSBqqEvmsq1sULTlxmT-4Vic';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const exportData = async () => {
  console.log('Starting Supabase data export...');
  
  const exportedData = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  // List of tables to export
  const tables = ['profiles', 'bookings', 'messages', 'reviews'];

  for (const table of tables) {
    try {
      console.log(`Exporting ${table}...`);
      
      // Get all data from the table
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: true }); // Order by created_at if exists
      
      if (error) {
        console.error(`Error exporting ${table}:`, error);
        // Try without ordering in case created_at doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from(table)
          .select('*');
        
        if (fallbackError) {
          console.error(`Fallback error for ${table}:`, fallbackError);
          exportedData.tables[table] = { error: fallbackError.message, data: [] };
        } else {
          exportedData.tables[table] = { data: fallbackData || [] };
        }
      } else {
        exportedData.tables[table] = { data: data || [] };
      }
      
      console.log(`✓ Exported ${exportedData.tables[table].data?.length || 0} records from ${table}`);
    } catch (err) {
      console.error(`Exception exporting ${table}:`, err);
      exportedData.tables[table] = { error: err.message, data: [] };
    }
  }

  // Save to JSON file
  const filename = `supabase-export-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(exportedData, null, 2));
  
  console.log(`\n✓ Export completed! Data saved to ${filename}`);
  console.log('\nSummary:');
  for (const [table, data] of Object.entries(exportedData.tables)) {
    if (data.error) {
      console.log(`  ${table}: ERROR - ${data.error}`);
    } else {
      console.log(`  ${table}: ${data.data.length} records`);
    }
  }
};

exportData().catch(console.error);