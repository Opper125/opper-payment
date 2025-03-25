const { v4: uuidv4 } = require('uuid');

exports.handler = async (event, context) => {
  try {
    const serverUrl = process.env.URL || 'https://opper-payment.netlify.app';
    const fullId = uuidv4().replace(/-/g, '');
    const shortId = fullId.slice(0, 6);

    return {
      statusCode: 200,
      body: JSON.stringify({ id: shortId, serverUrl }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate ID' }),
    };
  }
};
