const supabase = require('../backend/database/connection');

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase()).trim();
}

async function fix() {
  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, city')
      .not('city', 'is', null);

    if (error) throw error;

    console.log(`Fetched ${leads.length} leads with city.`);

    let updatedCount = 0;
    for (const lead of leads) {
      const formatted = toTitleCase(lead.city);
      if (formatted !== lead.city) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ city: formatted })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Failed to update lead ${lead.id}:`, updateError.message);
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`✓ Normalization completed. Updated ${updatedCount} leads.`);
    process.exit(0);
  } catch (e) {
    console.error('Error during normalization:', e);
    process.exit(1);
  }
}

fix();
