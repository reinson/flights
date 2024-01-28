import * as express from 'express';
import * as morgan from 'morgan';

import { notNil, flatten } from '../util';
import { Airport, GroupedRoutesBySource, Route, groupRoutesBySource, loadAirportData, loadRouteData } from '../data';

const filterHavTay = (routes: Route[]) =>
	routes.filter(({ destination, source }: Route) => {
		return ['HAVNAS', 'NASJFK', 'JFKHEL', 'HELTAY', 'NASBOS', 'BOSKEF', 'KEFHEL'].includes(
			source.iata + destination.iata,
		);
	});

const dijkstra = (
	sourceAirport: Airport,
	destinationAirport: Airport,
	allowedHops: number,
	airports: Airport[],
	routesBySource: GroupedRoutesBySource,
) => {
	type ShortestDistanceTable = {
		[airportId: Airport['id']]: {
			distance: number;
			hops: Airport['iata'][];
		};
	};

	const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
		unvisitedAirports.reduce((currentMin, airport, index) => {
			const tableEntry = shortestDistanceTable[airport.id];

			if (tableEntry?.distance === undefined || tableEntry.hops.length >= allowedHops) {
				return currentMin;
			}

			if (!currentMin.distance || currentMin.distance > tableEntry.distance) {
				return { distance: tableEntry.distance, airport, index };
			}

			return currentMin;
		}, {} as { distance: number; airport: Airport; index: number });

	const isNewSmallestDistance = (distanceFromSource: number, currentSmallest?: number) =>
		!currentSmallest || distanceFromSource < currentSmallest;

	let unvisitedAirports: Airport[] = [...airports];
	const shortestDistance: ShortestDistanceTable = {
		[sourceAirport.id]: {
			distance: 0,
			hops: [],
		},
	};

	while (true) {
		const {
			distance,
			airport: currentAirport,
			index: currentAirportIndex,
		} = selectNextAirportToVisit(shortestDistance, unvisitedAirports);

		if (!currentAirport) {
			break;
		}

		const currentAirportConnections = routesBySource[currentAirport.id] || [];

		for (const connection of currentAirportConnections) {
			const distanceFromSource = distance + connection.distance;
			const destinationId = connection.destination.id;
			const currentSmallestDistance = shortestDistance[destinationId]?.distance;
			if (isNewSmallestDistance(distanceFromSource, currentSmallestDistance)) {
				shortestDistance[destinationId] = {
					distance: distanceFromSource,
					hops: [...shortestDistance[currentAirport.id].hops, currentAirport.iata],
				};
			}
		}

		unvisitedAirports.splice(currentAirportIndex, 1);
	}

	return shortestDistance[destinationAirport.id] || ({} as { distance?: number; hops: string[] });
};

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

	const routesRaw = await loadRouteData();
	const routes = filterHavTay(routesRaw);

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

		const { distance, hops } = dijkstra(sourceAirport, destinationAirport, allowedHops, airports, routesBySource);

		if (!distance) {
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
			distance,
			hops: [...hops, destinationAirport.iata],
		});
	});

	return app;
}
