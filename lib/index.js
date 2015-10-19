var amqp = require('amqp');
var Promise = require('bluebird');

function createWaitQueue(options) {

    var connection = amqp.createConnection(),
        deadRabbit = this,
        routingKeys = options.routingKeys || [];

    //options normalization
    options.exchangeName = options.exchangeName || "wait-exchange";
    options.queueName = options.queueName || "wait-queue";
    options.exchange = options.exchange || {};

    return new Promise(function(res) {
        connection.on('ready', function() {
            deadRabbit.waitExchange = connection.exchange(options.exchangeName, options.exchange, connectToWaitQueue);

            function connectToWaitQueue() {
                var waitQueueOptions = { arguments: { "x-dead-letter-exchange": "primary-exchange" } };

                connection.queue(options.queueName, waitQueueOptions, function(queue) {
                    deadRabbit.waitQueue = queue;
                    routingKeys.map(function(routingKey) {
                        queue.bind(options.exchangeName, routingKey);
                    });
                    res(deadRabbit);
                });
            }
        });
    });
}

function forwardDeadLetter(message, headers, deliveryInfo, messageObject, options) {
    if (!this.waitExchange) throw new Error('A wait exchange must be established in #createWaitQueue');
    var options = options || {};

    var expiration = options.defaultExpiration || 10000;
    var backoffMultiplier = options.backoffMultiplier || 2;
    if (headers['x-death'])
        expiration = headers["x-death"][0]["original-expiration"] * backoffMultiplier;

    var messageOptions = {};

    if (headers) messageOptions.headers = headers;
    if (expiration.toString()) messageOptions.expiration = expiration.toString();
    assignIfDefined(messageObject, messageOptions, ['appId', 'timestamp', 'contentType', 'deliveryMode']);

    this.waitExchange.publish(deliveryInfo.routingKey, message, messageOptions);
    messageObject.acknowledge(false);

    function assignIfDefined(source, target, keys) {
        keys.forEach(function(key) {
            if (typeof source[key] !== 'undefined')
                target[key] = source[key];
        });
    }
}

module.exports = function createDeadRabbit() {
    this.createWaitQueue = createWaitQueue;
    this.forwardDeadLetter = forwardDeadLetter;
};
