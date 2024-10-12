/*
COMP 4537
LAB 5
DB Intro

AUTHHORS:
SAM T.
TEDRICK D.

This lab was made with ChatGPT 4o-mini


*/

const http = require('http');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();
const messages = require('./lang/en/messages'); // Import the messages
const PATIENTS_URL = "/api/patients";
const QUERY_URL = "/api/query";

class PatientServer {
    constructor(port) {
        this.port = port || process.env.PORT;
        this.db = new sqlite3.Database('patients.db'); // This creates a persistent database
        this.initializeDatabase();
        this.server = http.createServer(this.requestHandler.bind(this));
    }

    initializeDatabase() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                birthdate TEXT NOT NULL
            );`, (err) => {
                if (err) {
                    console.error(messages.errorCreation, err);
                } else {
                    console.log(messages.duplicateDatabase);
                }
            });
        });
    }

    requestHandler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        const parsedUrl = url.parse(req.url, true);
        const method = req.method;

        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (method === 'POST' && parsedUrl.pathname === PATIENTS_URL) {
            const patients = [
                { name: 'Sara Brown', birthdate: '1901-01-01' },
                { name: 'John Smith', birthdate: '1941-01-01' },
                { name: 'Jack Ma', birthdate: '1961-01-30' },
                { name: 'Elon Musk', birthdate: '1999-01-01' },
            ];

            const insertPromises = patients.map(patient => {
                return new Promise((resolve, reject) => {
                    this.db.run(`INSERT INTO patients (name, birthdate) VALUES (?, ?)`, [patient.name, patient.birthdate], function(err) {
                        if (err) {
                            console.error(messages.errorInsert, err);
                            reject(err);
                        } else {
                            resolve(this.lastID);
                        }
                    });
                });
            });

            Promise.all(insertPromises)
                .then(() => {
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: messages.patientsInserted })); // Use message from messages.js
                })
                .catch(err => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: messages.failedToInsertPatients })); // Use message from messages.js
                });
        } else if (method === 'POST' && parsedUrl.pathname === QUERY_URL) {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
        
            req.on('end', () => {
                const { query } = JSON.parse(body);

                // Validate query
                const trimmedQuery = query.trim().toUpperCase();
                if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('INSERT')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: messages.onlySelectInsertAllowed })); // Use message from messages.js
                    return;
                }

                this.db.all(query, [], (err, rows) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: messages.queryError })); // Use message from messages.js
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(rows));
                    }
                });
            });
        } else if (method === 'GET' && parsedUrl.pathname.startsWith(`${QUERY_URL}/`)) {
            // Extract the query from the URL
            let query = decodeURIComponent(parsedUrl.pathname.replace(`${QUERY_URL}/`, ''));

            // Remove enclosing quotes if present
            if (query.startsWith('"') && query.endsWith('"')) {
                query = query.slice(1, -1); // Strip the quotes
            }

            // Validate the query (allow only SELECT and INSERT)
            const trimmedQuery = query.trim().toUpperCase();
            if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('INSERT')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: messages.onlySelectInsertAllowed })); // Use message from messages.js
                return;
            }

            // Execute the query
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: messages.queryError })); // Use message from messages.js
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rows));
                }
            });
        } else if (method === 'GET' && parsedUrl.pathname === PATIENTS_URL) {
            this.db.all(`SELECT * FROM patients`, [], (err, rows) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: messages.retrievalError })); // Use message from messages.js
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rows));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: messages.resourceNotFound })); // Use message from messages.js
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
        });
    }
}

// Create and start the server
const port = 3000;
const patientServer = new PatientServer(port);
patientServer.start();
