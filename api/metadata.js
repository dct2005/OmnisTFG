const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type } = req.query;
    if (!['genres', 'themes'].includes(type)) {
        return res.status(400).json({ error: 'Tipo de metadatos no válido' });
    }

    try {
        const body = "fields name; limit 500; sort name asc;";
        const endpoint = `https://api.igdb.com/v4/${type}`;

        const response = await axios.post(
            endpoint,
            body,
            {
                headers: {
                    "Client-ID": process.env.TWITCH_CLIENT_ID,
                    "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error(`IGDB ${type} Error:`, err.message);
        res.status(500).json({ error: `IGDB ${type} error`, details: err.message });
    }
};
