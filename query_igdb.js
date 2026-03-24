const axios = require('axios');
async function query() {
    const response = await axios.post("https://api.igdb.com/v4/games", 
        "fields name, version_parent, parent_game, bundles; where name = \"The Witcher 3: Wild Hunt\"; limit 5;",
        {
            headers: {
                "Client-ID": process.env.TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
            }
        });
    console.log(JSON.stringify(response.data, null, 2));
}
query();
