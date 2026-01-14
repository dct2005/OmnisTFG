const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const response = await axios.post(
            "https://api.igdb.com/v4/games",
            "fields name, cover.url, rating; limit 10;",
            {
                headers: {
                    "Client-ID": process.env.TWITCH_CLIENT_ID,
                    "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("IGDB Error:", err.message);
        res.status(500).json({
            error: "IGDB error",
            details: err.response?.data || err.message
        });
    }
};


