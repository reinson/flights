import * as express from 'express';
import * as morgan from 'morgan';

import { notNil, flatten } from '../util';
import { Airport, Route, loadAirportData, loadRouteData, prepareRoutesData } from '../data';
import { findShortestDistances } from './algorithms';

const DEFAULT_ALLOWED_HOPS_COUNT = 4;

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
	const { routesBySource, routesBySourceWithGroundHops } = prepareRoutesData(routes, airports);

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
		const allowedHops = +req.query.allowed_hops || DEFAULT_ALLOWED_HOPS_COUNT;
		const allowGroundHops = req.query.hasOwnProperty('with-ground-hops');

		if (source === undefined || destination === undefined) {
			return res.status(400).send('Must provide source and destination airports');
		}

		const sourceAirport = airportsByCode.get(source.toLowerCase());
		const destinationAirport = airportsByCode.get(destination.toLowerCase());
		if (sourceAirport === undefined || destinationAirport === undefined) {
			return res.status(404).send('No such airport, please provide a valid IATA/ICAO codes');
		}

		const routes = allowGroundHops ? routesBySourceWithGroundHops : routesBySource;
		const shortestDistances = findShortestDistances(sourceAirport, allowedHops, routes, airports);
		const shortestToDestination = shortestDistances[destinationAirport.id];

		if (shortestToDestination.distance === Infinity) {
			return res.status(404).send({
				source,
				destination,
				allowed_hops: allowedHops,
				message: 'not connected in allowed hops count',
			});
		}

		const hopsIncludingGround = shortestToDestination.hops
			.map((route: Route) => [route.groundHopFrom?.iata, route.destination.iata])
			.flat()
			.filter(notNil);

		return res.status(200).send({
			source,
			destination,
			distance: shortestToDestination.distance,
			hops: [sourceAirport.iata, ...hopsIncludingGround],
		});
	});

	return app;
}
