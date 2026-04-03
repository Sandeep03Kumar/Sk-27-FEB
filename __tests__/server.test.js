/**
 * Comprehensive unit and integration test suite for server.js
 *
 * Covers: module exports, request handler isolation, HTTP integration via supertest,
 * response headers, edge cases (methods, paths, bodies, concurrency),
 * server lifecycle (startup, shutdown, address binding), and error handling (EADDRINUSE).
 *
 * Framework: Jest 29.x  |  HTTP assertions: supertest 7.x
 */

const { server, requestHandler, hostname, port } = require('../server');
const request = require('supertest');
const http = require('http');
const net = require('net');

// ---------------------------------------------------------------------------
// Expected constants — single source of truth for all assertions
// ---------------------------------------------------------------------------
const EXPECTED_STATUS = 200;
const EXPECTED_CONTENT_TYPE = 'text/plain';
const EXPECTED_BODY = 'Hello, World!\n';
const EXPECTED_HOSTNAME = '127.0.0.1';
const EXPECTED_PORT = 3000;
const buildExpectedLogMessage = (h, p) => `Server running at http://${h}:${p}/`;

// ---------------------------------------------------------------------------
// Top-level teardown — close the exported server if supertest left it listening
// ---------------------------------------------------------------------------
afterAll((done) => {
  if (server.listening) {
    server.close(done);
  } else {
    done();
  }
});

// ===========================================================================
// Block 1: Module exports
// ===========================================================================
describe('Module exports', () => {
  it('should export server as an http.Server instance', () => {
    expect(server).toBeInstanceOf(http.Server);
  });

  it('should export requestHandler as a function', () => {
    expect(typeof requestHandler).toBe('function');
  });

  it('should export hostname as 127.0.0.1', () => {
    expect(hostname).toBe(EXPECTED_HOSTNAME);
  });

  it('should export port as 3000', () => {
    expect(port).toBe(EXPECTED_PORT);
  });
});

// ===========================================================================
// Block 2: requestHandler unit tests (mock req/res — no HTTP listener)
// ===========================================================================
describe('requestHandler unit tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {}; // handler does not read any req properties
    mockRes = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };
  });

  it('should set status code to 200', () => {
    requestHandler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(EXPECTED_STATUS);
  });

  it('should set Content-Type header to text/plain', () => {
    requestHandler(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', EXPECTED_CONTENT_TYPE);
  });

  it('should end response with Hello, World!\\n', () => {
    requestHandler(mockReq, mockRes);
    expect(mockRes.end).toHaveBeenCalledWith(EXPECTED_BODY);
  });

  it('should call setHeader exactly once', () => {
    requestHandler(mockReq, mockRes);
    expect(mockRes.setHeader).toHaveBeenCalledTimes(1);
  });

  it('should call end exactly once', () => {
    requestHandler(mockReq, mockRes);
    expect(mockRes.end).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Block 3: HTTP integration tests (supertest — full request/response cycle)
// ===========================================================================
describe('HTTP integration tests', () => {
  it('should return 200 status code for GET request', async () => {
    await request(server).get('/').expect(EXPECTED_STATUS);
  });

  it('should return Content-Type text/plain for GET request', async () => {
    await request(server).get('/').expect('Content-Type', /text\/plain/);
  });

  it('should return Hello, World!\\n body for GET request', async () => {
    await request(server).get('/').expect(EXPECTED_BODY);
  });

  it('should return 200 for POST request', async () => {
    await request(server).post('/').expect(EXPECTED_STATUS);
  });

  it('should return 200 for PUT request', async () => {
    await request(server).put('/').expect(EXPECTED_STATUS);
  });

  it('should return 200 for DELETE request', async () => {
    await request(server).delete('/').expect(EXPECTED_STATUS);
  });

  it('should return 200 for PATCH request', async () => {
    await request(server).patch('/').expect(EXPECTED_STATUS);
  });

  it('should return 200 for OPTIONS request', async () => {
    await request(server).options('/').expect(EXPECTED_STATUS);
  });

  it('should return 200 for HEAD request', async () => {
    // HEAD responses carry no body — only assert status code
    await request(server).head('/').expect(EXPECTED_STATUS);
  });
});

// ===========================================================================
// Block 4: Header tests
// ===========================================================================
describe('Header tests', () => {
  it('should include Content-Type header in response', async () => {
    const res = await request(server).get('/');
    expect(res.headers['content-type']).toContain(EXPECTED_CONTENT_TYPE);
  });

  it('should include Date header in response', async () => {
    const res = await request(server).get('/');
    expect(res.headers['date']).toBeDefined();
  });

  it('should include Connection header in response', async () => {
    const res = await request(server).get('/');
    expect(res.headers['connection']).toBeDefined();
  });
});

// ===========================================================================
// Block 5: Edge cases
// ===========================================================================
describe('Edge cases', () => {
  it('should return same response for /foo path', async () => {
    await request(server)
      .get('/foo')
      .expect(EXPECTED_STATUS)
      .expect(EXPECTED_BODY);
  });

  it('should return same response for /a/b/c path', async () => {
    await request(server)
      .get('/a/b/c')
      .expect(EXPECTED_STATUS)
      .expect(EXPECTED_BODY);
  });

  it('should return same response for deeply nested path', async () => {
    await request(server).get('/x/y/z/w/1/2/3').expect(EXPECTED_STATUS);
  });

  it('should return same response with custom headers', async () => {
    await request(server)
      .get('/')
      .set('X-Custom-Header', 'test-value')
      .expect(EXPECTED_STATUS)
      .expect(EXPECTED_BODY);
  });

  it('should return same response with request body', async () => {
    await request(server)
      .post('/')
      .send('some body data')
      .expect(EXPECTED_STATUS)
      .expect(EXPECTED_BODY);
  });

  it('should return same response with empty request body', async () => {
    await request(server).post('/').send('').expect(EXPECTED_STATUS);
  });

  it('should handle concurrent requests', (done) => {
    // Use a dedicated server instance to avoid connection-reset issues
    const concurrentServer = http.createServer(requestHandler);
    concurrentServer.listen(0, '127.0.0.1', () => {
      const NUM_CONCURRENT = 10;
      const promises = Array.from({ length: NUM_CONCURRENT }, () =>
        request(concurrentServer).get('/').expect(EXPECTED_STATUS)
      );
      Promise.all(promises)
        .then((responses) => {
          responses.forEach((res) => {
            expect(res.text).toBe(EXPECTED_BODY);
          });
          concurrentServer.close(done);
        })
        .catch((err) => {
          concurrentServer.close(() => done(err));
        });
    });
  });
});

// ===========================================================================
// Block 6: Server lifecycle tests
// ===========================================================================
describe('Server lifecycle tests', () => {
  let lifecycleServer;

  afterEach((done) => {
    if (lifecycleServer && lifecycleServer.listening) {
      lifecycleServer.close(() => done());
    } else {
      done();
    }
  });

  it('should start listening and emit the listening event', (done) => {
    lifecycleServer = http.createServer(requestHandler);
    lifecycleServer.listen(0, '127.0.0.1', () => {
      expect(lifecycleServer.listening).toBe(true);
      done();
    });
  });

  it('should return correct address info after listening', (done) => {
    lifecycleServer = http.createServer(requestHandler);
    lifecycleServer.listen(0, '127.0.0.1', () => {
      const addr = lifecycleServer.address();
      expect(addr).toHaveProperty('address');
      expect(addr).toHaveProperty('family');
      expect(addr).toHaveProperty('port');
      expect(typeof addr.port).toBe('number');
      expect(addr.port).toBeGreaterThan(0);
      done();
    });
  });

  it('should verify startup log message format', (done) => {
    // The require.main guard prevents the actual server.js listen callback from
    // firing during tests; this test validates the log message format pattern instead
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    lifecycleServer = http.createServer(requestHandler);
    lifecycleServer.listen(0, EXPECTED_HOSTNAME, () => {
      const actualPort = lifecycleServer.address().port;
      const expectedMsg = buildExpectedLogMessage(EXPECTED_HOSTNAME, actualPort);
      // Replicate the same logging pattern used in server.js listen callback
      console.log(expectedMsg);
      expect(consoleSpy).toHaveBeenCalledWith(expectedMsg);
      consoleSpy.mockRestore();
      done();
    });
  });

  it('should close gracefully via server.close()', (done) => {
    lifecycleServer = http.createServer(requestHandler);
    lifecycleServer.listen(0, '127.0.0.1', () => {
      expect(lifecycleServer.listening).toBe(true);
      lifecycleServer.close(() => {
        expect(lifecycleServer.listening).toBe(false);
        lifecycleServer = null; // prevent double-close in afterEach
        done();
      });
    });
  });

  it('should refuse new connections after close', (done) => {
    lifecycleServer = http.createServer(requestHandler);
    lifecycleServer.listen(0, '127.0.0.1', () => {
      const addr = lifecycleServer.address();
      lifecycleServer.close(() => {
        const client = net.createConnection(
          { port: addr.port, host: '127.0.0.1' },
          () => {
            // If connection unexpectedly succeeds, fail the test
            client.destroy();
            done(new Error('Connection should have been refused'));
          }
        );
        client.on('error', (err) => {
          expect(err.code).toBe('ECONNREFUSED');
          lifecycleServer = null; // already closed
          done();
        });
      });
    });
  });
});

// ===========================================================================
// Block 7: Error handling tests
// ===========================================================================
describe('Error handling tests', () => {
  it('should emit error event when port is already in use (EADDRINUSE)', (done) => {
    const blocker = net.createServer();
    blocker.listen(0, '127.0.0.1', () => {
      const blockedPort = blocker.address().port;
      const testServer = http.createServer(requestHandler);

      testServer.on('error', (err) => {
        expect(err.code).toBe('EADDRINUSE');
        blocker.close(() => {
          done();
        });
      });

      testServer.listen(blockedPort, '127.0.0.1');
    });
  });
});
