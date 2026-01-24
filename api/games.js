const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { search, offset, genres, themes } = req.query;
        // Construir la query paso a paso para evitar errores de sintaxis
        let queryParts = [];

        // Fields
        queryParts.push("fields name, cover.url, rating, involved_companies.company.name, involved_companies.developer, genres.name, themes.name;");

        // Where conditions
        let whereConditions = ["cover != null"];
        if (search) {
            whereConditions.push(`name ~ *"${search}"*`); // Búsqueda más flexible
        } else {
            whereConditions.push("rating > 70"); // Filtro base para calidad
            whereConditions.push("rating_count > 10");
        }

        // Add Categories (Genres) Filter
        if (genres) {
            const genresArr = Array.isArray(genres) ? genres : [genres];
            const genresString = genresArr.map(g => `"${g}"`).join(",");
            whereConditions.push(`genres.name = (${genresString})`);
        }

        // Add Themes Filter
        if (themes) {
            const themesArr = Array.isArray(themes) ? themes : [themes];
            const themesString = themesArr.map(t => `"${t}"`).join(",");
            whereConditions.push(`themes.name = (${themesString})`);
        }

        queryParts.push(`where ${whereConditions.join(" & ")};`);

        // Sort
        if (!search) {
            queryParts.push("sort popularity desc;");
        }

        // Offset & Limit
        queryParts.push(`limit 20;`);
        queryParts.push(`offset ${offset || 0};`); // Asegurar que offset siempre tenga valor

        const body = queryParts.join(" ");

        const response = await axios.post(
            "https://api.igdb.com/v4/games",
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
        console.error("IGDB Error:", err.message);
        res.status(500).json({
            error: "IGDB error",
            details: err.response?.data || err.message
        });
    }
};

// Este código ha sido editado a altas horas de la madrugada, con altos niveles de cafeína y azúcar en sangre.
//                      :::!~!!!!!:.
//                   .xUHWH!! !!?M88WHX:.
//                 .X*#M@$!!  !X!M$$$$$$WWx:.
//                :!!!!!!?H! :!$!$$$$$$$$$$8X:
//               !!~  ~:~!! :~!$!#$$$$$$$$$$8X:
//              :!~::!H!<   ~.U$X!?R$$$$$$$$MM!
//              ~!~!!!!~~ .:XW$$$U!!?$$$$$$RMM!
//                !:~~~ .:!M"T#$$$$WX??#MRRMMM!
//                ~?WuxiW*`   `"#$$$$8!!!!??!!!
//              :X- M$$$$       `"T#$T~!8$WUXU~
//             :%`  ~#$$$m:        ~!~ ?$$$$$$
//           :!`.-   ~T$$$$8xx.  .xWW- ~""##*"
// .....   -~~:<` !    ~?T#$$@@W@*?$$      /`
// W$@@M!!! .!~~ !!     .:XUW$W!~ `"~:    :
// #"~~`.:x%`!!  !H:   !WM$$$$Ti.: .!WUn+!`
// :::~:!!`:X~ .: ?H.!u "$$$B$$$!W:U!T$$M~
// .~~   :X@!.-~   ?@WTWo("*$$$W$TH$! `
// Wi.~!X$?!-~    : ?$$$B$Wu("**$RM!
// $R@i.~~ !     :   ~$$$$$B$$en:``
// ?MXT@Wx.~    :     ~"##*$$$$M~