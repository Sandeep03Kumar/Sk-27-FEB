const http = require('http'); // Qa
// Qa
const hostname = '127.0.0.1'; // Qa
const port = 3000; // Qa
// Qa
const requestHandler = (req, res) => { // Qa
  res.statusCode = 200; // Qa
  res.setHeader('Content-Type', 'text/plain'); // Qa
  res.end('Hello, World!\n'); // Qa
}; // Qa
// Qa
const server = http.createServer(requestHandler); // Qa
// Qa
if (require.main === module) { // Qa
  server.listen(port, hostname, () => { // Qa
    console.log(`Server running at http://${hostname}:${port}/`); // Qa
  }); // Qa
} // Qa
// Qa
module.exports = { server, requestHandler, hostname, port }; // Qa
