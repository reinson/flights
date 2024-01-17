# Transporeon Visibility Hub backend test-task

## Task description

The test task consists of two parts, the main part, and a bonus part. We suggest tackling the bonus part once the main objective of the service has been achieved.

The task is to build a JSON over HTTP API endpoint that takes as input two IATA/ICAO airport codes and provides as output a route between these two airports so that:

1. The route consists of at most 4 legs/flights (that is, 3 stops/layovers, if going from A->B, a valid route could be A->1->2->3->B, or for example A->1->B etc.) and;
2. The route is the shortest such route as measured in kilometers of geographical distance.

For the bonus part, extend your service so that it also allows changing airports during stops that are within 100km of each other. For example, if going from A->B, a valid route could be A->1->2=>3->4->B, where “2=>3” is a change of airports done via ground. Multiple ground hops are allowed, but they cannot be consecutive. These switches are not considered as part of the legs/layover/hop count, but their distance should be reflected in the final distance calculated for the route.

The bonus part should be opt-in by providing a query parameter `with-ground-hops` to the request.

Notes:

1. The weekdays and flight times are not important for the purposes of the test task - you are free to assume that all flights can depart any required time
2. You are free to choose to use any open-source libraries
3. You can ask additional questions

## Service

In this repository, you will find an [express](https://www.npmjs.com/package/express) service written in [typescript](https://www.npmjs.com/package/typescript). The repository assumes you have configured [Yarn](https://yarnpkg.com) and [Node.js (18+)](https://nodejs.org/en/) on your system.

Your goal is to modify this service so that it fulfills the requirements of the test task.

The service is already configured with data from [OpenFlights](https://openflights.org/data.html), which albeit outdated, will work fine for the purposes of this test task.

The service also includes a set of tests, which can be executed via `yarn test`, these represent two cases for the first part and one case for the second part of the task. Once you are confident that your solution works, these tests should pass. **Notice that these tests also enforce a specific response format for your service.**

## Docker

The service is also setup to run in docker, you can use the docker-compose file to run either the service itself (exposes the same port 3000 as with `yarn start`/`yarn start:dev`) - `docker-compose up -d service`.

You can also run the tests via `docker-compose up test`.
