const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const gamesHandler = require('../api/games');
const metadataHandler = require('../api/metadata');
const userHandler = require('../api/user/index');

app.all('/api/games', async (req, res) => {
    try {
        await gamesHandler(req, res);
    } catch (error) {
        console.error('Error in API handler:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.all('/api/metadata', async (req, res) => {
    try {
        await metadataHandler(req, res);
    } catch (error) {
        console.error('Error in Metadata handler:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.all('/api/user', async (req, res) => {
    try {
        await userHandler(req, res);
    } catch (error) {
        console.error('Error in User handler:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.listen(port, () => {
    console.log(`Local API server running at http://localhost:${port}`);
});
