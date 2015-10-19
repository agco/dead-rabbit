//dependencies
var amqp = require('amqp');
var expect = require('chai').expect;
var Promise = require('bluebird');

//local files
var DeadRabbit = require('../lib/index');

describe('dead-rabbit', function() {
    var deadRabbit;
    beforeEach(function() {
         deadRabbit = new DeadRabbit();
    });

    describe('#createWaitQueue', function() {
        it('is a function', function() {
            expect(deadRabbit.createWaitQueue).to.be.a('function');
        });
    });

    describe('#forwardDeadLetter', function() {
        it('is a function', function() {
            expect(deadRabbit.forwardDeadLetter).to.be.a('function');
        });

        it('throws an error if #createWaitQueue hasn\'t been called first', function() {
            expect(deadRabbit.forwardDeadLetter).to.throw(Error, /A wait exchange must be established in #createWaitQueue/);
        });

        describe('Given a created wait queue and a failed subscriber', function() {
            var primaryExchange;
            var routingKeys = ['key-a'];
            beforeEach( function(done) {
                this.timeout(10000);
                var options = {
                    routingKeys: routingKeys
                };
                return deadRabbit.createWaitQueue(options)
                    .then(createPrimaryListener);

                function createPrimaryListener(deadRabbit) {
                    var connection = amqp.createConnection();
                    connection.on('ready', function() {
                        connection.exchange('primary-exchange', {}, function(exchange) {
                            primaryExchange = exchange;
                            connection.queue('primary-queue', {}, function(primaryQueue) {
                                routingKeys.map(function(routingKey) {
                                    primaryQueue.bind("primary-exchange", routingKey);
                                });

                                primaryQueue.subscribe({ack: true}, function(message, headers, deliveryInfo, messageObject) {
                                    deadRabbit.forwardDeadLetter.apply(deadRabbit, arguments);
                                });
                                Promise.delay(5000).then(function() {done()});
                            });
                        });
                    });
                }
            });

            describe.only('When a message is published to the primary queue', function() {
                it('is handled by the waitExchange', function(done) {
                    primaryExchange.publish(routingKeys[0], {test: 'test'});

                    deadRabbit.waitQueue.subscribe(function(message, headers, deliveryInfo, messageObject) {
                        done();
                    });
                });
            });
        });
    });
});
