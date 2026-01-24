const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const body = "fields name; limit 500; sort name asc;";

        const response = await axios.post(
            "https://api.igdb.com/v4/themes",
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
        console.error("IGDB Themes Error:", err.message);
        res.status(500).json({ error: "IGDB Themes error", details: err.message });
    }
};
