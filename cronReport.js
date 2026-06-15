const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('./encryption');
const generatePdf = require('./generatePdf');

// Helper to convert pdfmake document stream into a Buffer
function getPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
}

async function handleTelegramCronReport(req, res) {
  try {
    // 1. Verify Authentication via X-Cron-Secret header
    const cronSecret = process.env.CRON_SECRET;
    const clientSecret = req.headers['x-cron-secret'] || req.query.secret;

    if (!cronSecret || clientSecret !== cronSecret) {
      console.warn('Unauthorized cron trigger attempt.');
      return res.status(401).json({ error: 'Unauthorized: Invalid cron secret.' });
    }

    // 2. Validate essential environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars in backend.');
      return res.status(500).json({ error: 'Server configuration error: Missing database credentials.' });
    }

    // Initialize Supabase Client
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Cron Job Triggered: Fetching open trips...');

    // 3. Fetch all open trips
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .eq('status', 'open');

    if (tripsError) {
      throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    }

    if (!trips || trips.length === 0) {
      console.log('No unsettled (open) trips found.');
      return res.status(200).json({ status: 'OK', message: 'No open trips found. No backups sent.' });
    }

    console.log(`Found ${trips.length} open trips. Fetching Telegram settings...`);

    // 4. Fetch & Decrypt Telegram Credentials
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('setting_key, encrypted_value, iv, auth_tag')
      .in('setting_key', ['telegram_bot_token', 'telegram_chat_id']);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    if (!settings || settings.length < 2) {
      throw new Error('Telegram credentials are not fully configured in settings.');
    }

    const credentials = {};
    for (const row of settings) {
      credentials[row.setting_key] = decrypt({
        encrypted: row.encrypted_value,
        iv: row.iv,
        authTag: row.auth_tag
      });
    }

    const botToken = credentials.telegram_bot_token;
    const chatId = credentials.telegram_chat_id;

    if (!botToken || !chatId) {
      throw new Error('Decrypted bot token or chat ID is empty.');
    }

    // 5. Loop through each trip and send PDF report
    const results = [];
    
    for (const trip of trips) {
      const tripId = trip.id;
      const tripCode = trip.trip_code || `TR-${tripId}`;
      console.log(`Processing report for trip ${tripCode}...`);

      try {
        // Fetch sub-ledger logs for the trip
        const [
          { data: summary },
          { data: incomeList },
          { data: dieselList },
          { data: advancesList },
          { data: otherList }
        ] = await Promise.all([
          supabase.from('trip_summary').select('*').eq('trip_id', tripId).maybeSingle(),
          supabase.from('income').select('*').eq('trip_id', tripId).order('date', { ascending: false }),
          supabase.from('diesel').select('*').eq('trip_id', tripId).order('date', { ascending: false }),
          supabase.from('driver_advances').select('*').eq('trip_id', tripId).order('date', { ascending: false }),
          supabase.from('other_expenses').select('*').eq('trip_id', tripId).order('date', { ascending: false })
        ]);

        const payload = {
          trip,
          summary,
          incomeList: incomeList || [],
          dieselList: dieselList || [],
          advancesList: advancesList || [],
          otherList: otherList || []
        };

        // Generate PDF
        const doc = generatePdf(payload);
        const pdfBuffer = await getPdfBuffer(doc);

        // Upload to Telegram using native global fetch and FormData
        const formData = new FormData();
        formData.append('chat_id', chatId);
        
        const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
        formData.append('document', fileBlob, `Trip_Report_${tripCode}.pdf`);
        
        const caption = `Backup Report: Unsettled Trip Ledger\n` +
                        `• Code: ${tripCode}\n` +
                        `• Truck: ${trip.truck_number || '-'}\n` +
                        `• Driver: ${trip.driver_name || '-'}\n` +
                        `• Route: ${trip.from_location || '-'} to ${trip.to_location || '-'}`;
        formData.append('caption', caption);

        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          body: formData
        });

        if (!tgRes.ok) {
          const errText = await tgRes.text();
          throw new Error(`Telegram API responded with ${tgRes.status}: ${errText}`);
        }

        console.log(`Successfully sent PDF for trip ${tripCode} to Telegram.`);
        results.push({ tripCode, success: true });

      } catch (tripErr) {
        console.error(`Error processing trip ${tripCode}:`, tripErr.message);
        results.push({ tripCode, success: false, error: tripErr.message });
      }
    }

    res.status(200).json({
      status: 'OK',
      processed: trips.length,
      results
    });

  } catch (err) {
    console.error('Cron job failed:', err.message);
    res.status(500).json({ error: 'Cron job execution failed.', details: err.message });
  }
}

module.exports = { handleTelegramCronReport };
