import * as express from 'express';
import * as morgan from 'morgan';

import { notNil, flatten } from '../util';
import { Airport, groupRoutesBySource, loadAirportData, loadRouteData } from '../data';
import { bruteForce, dijkstra } from './algorithms';

export async function createApp() {
	const app = express();

	const airports = await loadAirportData();
	const airportsByCode = new Map<string, Airport>(
		flatten(
			airports.map((airport) =>
				[
					airport.iata !== null ? ([airport.iata.toLowerCase(), airport] as const) : null,
					airport.icao !== null ? ([airport.icao.toLowerCase(), airport] as const) : null,
				].filter(notNil),
			),
		),
	);

	const routes = await loadRouteData();

	const routesBySource = groupRoutesBySource(routes);

	app.use(morgan('tiny'));

	app.get('/health', (_, res) => res.send('OK'));
	app.get('/airports/:code', (req, res) => {
		const code = req.params['code'];
		if (code === undefined) {
			return res.status(400).send('Must provide airport code');
		}

		const airport = airportsByCode.get(code.toLowerCase());
		if (airport === undefined) {
			return res.status(404).send('No such airport, please provide a valid IATA/ICAO code');
		}

		return res.status(200).send(airport);
	});

	app.get('/routes/:source/:destination', (req, res) => {
		const source = req.params['source'];
		const destination = req.params['destination'];
		const allowedHops = +req.query.allowed_hops || 4;
		if (source === undefined || destination === undefined) {
			return res.status(400).send('Must provide source and destination airports');
		}

		const sourceAirport = airportsByCode.get(source.toLowerCase());
		const destinationAirport = airportsByCode.get(destination.toLowerCase());
		if (sourceAirport === undefined || destinationAirport === undefined) {
			return res.status(404).send('No such airport, please provide a valid IATA/ICAO codes');
		}

		const dijkstraShortestDistance = dijkstra(sourceAirport, airports, routesBySource);
		const bruteForceShortest = bruteForce(sourceAirport, allowedHops, routesBySource, dijkstraShortestDistance);
		const shortestToDestination = bruteForceShortest[destinationAirport.id];
		
		if (!shortestToDestination) {
			return res.status(404).send({
				source,
				destination,
				allowed_hops: allowedHops,
				message: 'not connected in allowed hops count',
			});
		}

		return res.status(200).send({
			source,
			destination,
			distance: shortestToDestination.distance,
			hops: shortestToDestination.hops.map((airport: Airport) => airport.iata),
		});
	});

	return app;
}
