module.exports = Object.freeze({
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    MAIN_SITE_URL: process.env.MAIN_SITE_URL || 'https://sandoria.org/',

    PEER_SERVER_HOST: process.env.PEER_SERVER_HOST || 'peer-server.sandoria.org',
    PEER_SERVER_PORT: process.env.PEER_SERVER_PORT || '80',
    PEER_SERVER_PATH: process.env.PEER_SERVER_PATH || '/',
});