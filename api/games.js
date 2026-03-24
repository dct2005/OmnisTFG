const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { search, offset, genres, themes, id } = req.query;
        // Construir la query paso a paso para evitar errores de sintaxis
        let queryParts = [];

        // Campos
        queryParts.push("fields name, summary, cover.url, rating, rating_count, involved_companies.company.name, involved_companies.developer, genres.name, themes.name, dlcs.name, dlcs.cover.url, expansions.name, expansions.cover.url, bundles.name, bundles.cover.url;");

        // Condiciones
        let whereConditions = ["cover != null"];
        if (id) {
            whereConditions.push(`id = ${id}`);
        } else if (search) {
            whereConditions.push("game_type = (0, 8, 9, 11)"); //Juego base, remake, remaster, port
            whereConditions.push(`name ~ *"${search}"*`); // Búsqueda más flexible
        } else {
            whereConditions.push("game_type = (0, 8, 9, 11)"); //Juego base, remake, remaster, port
            whereConditions.push("rating > 70"); // Filtro base para calidad
            whereConditions.push("rating_count > 10");
        }

        // Filtro de generos
        if (genres) {
            const genresArr = Array.isArray(genres) ? genres : [genres];
            const genresString = genresArr.map(g => `"${g}"`).join(",");
            whereConditions.push(`genres.name = (${genresString})`);
        }

        // Filtro de tematicas
        if (themes) {
            const themesArr = Array.isArray(themes) ? themes : [themes];
            const themesString = themesArr.map(t => `"${t}"`).join(",");
            whereConditions.push(`themes.name = (${themesString})`);
        }

        queryParts.push(`where ${whereConditions.join(" & ")};`);

        // Ordenar
        if (!search && !id) {
            queryParts.push("sort popularity desc;");
        }

        // Limite y paginacion
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

        let processedData = response.data;

        // Función auxiliar para calcular precios en Peppix
        const calculatePeppixPrice = (game, isNested = false) => {
            if (isNested) {
                // Para DLCs/Expansiones, precio base menor
                return 1499 + Math.floor(Math.random() * 1500);
            }
            const rating = game.rating || 60;
            const ratingCount = game.rating_count || 0;
            const basePrice = (rating * 45) + (ratingCount / 10);
            // Redondear al 99 mas cercano (ej: 4999)
            return Math.max(999, Math.floor(basePrice / 100) * 100 + 99);
        };

        // Procesar cada juego para añadir el precio
        processedData = processedData.map(game => {
            game.peppixPrice = calculatePeppixPrice(game);
            
            // También a contenido adicional si existe
            if (game.dlcs) game.dlcs = game.dlcs.map(d => ({ ...d, peppixPrice: calculatePeppixPrice(d, true) }));
            if (game.expansions) game.expansions = game.expansions.map(e => ({ ...e, peppixPrice: calculatePeppixPrice(e, true) }));
            if (game.bundles) game.bundles = game.bundles.map(b => ({ ...b, peppixPrice: calculatePeppixPrice(b, true) * 1.2 })); // Bundles algo más caros

            return game;
        });

        // Si consultamos un juego en concreto (id existe) y tiene resumen, lo traducimos
        if (id && processedData.length > 0 && processedData[0].summary) {
            try {
                const game = processedData[0];
                const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=" + encodeURIComponent(game.summary);
                const translateResponse = await axios.get(url);

                if (translateResponse.data && Array.isArray(translateResponse.data[0])) {
                    const translatedText = translateResponse.data[0].map(item => item[0]).join('');
                    if (translatedText) {
                        game.summary = translatedText;
                    }
                }
            } catch (translateErr) {
                console.error("Translation Error (Google Translate):", translateErr.message);
                // Si la traducción falla (servidor caído, límite de uso), pasamos silenciosamente y devolvemos texto en inglés
            }
        }

        res.json(processedData);
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