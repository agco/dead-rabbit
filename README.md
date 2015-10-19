# Dead Rabbit
A small library of helper functions for creating and pushing to dead letter 
queues for AMQP. It includes options for gradual run off on message expiration.

AMQP is a message protocol like HTTP, but revolves around queues that maximize
guaranteed eventual completion out-of-the-box. If a task fails once, it can be
retried a number of times, and this module allows tasks that have failed to complete
after a given period of time to be automatically pushed to a waiting queue that
increases the timeout gradually.

Based on the [blog post](http://dev.venntro.com/2014/07/back-off-and-retry-with-rabbitmq/) by Josh Hill.

## Example

```javascript
  var DeadRabbit = require('dead-rabbit');
  var deadRabbit = new DeadRabbit();
  var options = {
      routingKeys: ['key-a', 'key-b'];
  };
  return deadRabbit.createWaitQueue(options)
      .then(createPrimaryListener);

  function createPrimaryListener(deadRabbit) {
      var connection = amqp.createConnection();
      connection.on('ready', function() {
          connection.exchange('primary-exchange', {}, function(exchange) {
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
```

## Methods
\#createWaitQueue must be called before \#forwardDeadLetter, as it establishes the connection to the exchange, deviation from this DSL throws an error. 

### deadRabbit.createWaitQueue([options])
This method constructs a wait queue that listens on the same routing keys as a primary queue. It accepts an options hash, such as:
```javascript
{
	exchange: {
    	//standard AMQP exchange options
    },
    exchangeName: "wait-exchange",
    queueName: "wait-queue",
    routingKeys: ["hit-by-truck", "eaten-by-fox"]
}
```
See the [node-amqp documentation](https://github.com/postwait/node-amqp) for valid exchange options.
 

### deadRabbit.forwardDeadLetter(message, headers, deliveryInfo, messageObject, [options])
\#forwardDeadLetter forwards the failed message to the wait queue. It takes the same arguments as are passed to the queue.subscribe() method from [node-amqp](https://github.com/postwait/node-amqp).

Options is a hash that can include defaultExpiration, an integer, which defaults to 10000, or backoffMultiplier, an integer that defaults to 2.
