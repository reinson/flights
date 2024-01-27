import * as express from 'express';
import * as morgan from 'morgan';

import { notNil, flatten } from '../util';
import { Airport, Route, groupRoutesBySource, loadAirportData, loadRouteData } from '../data';

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
		if (source === undefined || destination === undefined) {
			return res.status(400).send('Must provide source and destination airports');
		}

		const sourceAirport = airportsByCode.get(source.toLowerCase());
		const destinationAirport = airportsByCode.get(destination.toLowerCase());
		if (sourceAirport === undefined || destinationAirport === undefined) {
			return res.status(404).send('No such airport, please provide a valid IATA/ICAO codes');
		}

		type ShortestDistanceTable = {
			[airportId: Airport['id']]: {
				distance: number;
				hops: Airport['iata'][];
				previousNode?: Airport;
			};
		};

		const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
			unvisitedAirports.reduce((currentMin, airport, index) => {
				const distance = shortestDistanceTable[airport.id].distance;
				if (!currentMin.distance || currentMin.distance > distance) {
					return { distance, airport, index };
				}
				return currentMin;
			}, {} as { distance: number; airport: Airport; index: number });

		const isNewSmallestDistance = (distanceFromSource: number, currentSmallest?: number) =>
			!currentSmallest || distanceFromSource < currentSmallest;

		const visitedAirports: Airport['id'][] = [];
		let unvisitedAirports: Airport[] = [sourceAirport];

		const shortestDistance: ShortestDistanceTable = {
			[sourceAirport.id]: {
				distance: 0,
				hops: [],
			},
		};

		while (true) {
			if (unvisitedAirports.length === 0) {
				break;
			}

			const {
				distance,
				airport: currentAirport,
				index: currentAirportIndex,
			} = selectNextAirportToVisit(shortestDistance, unvisitedAirports);
			const currentAirportConnections = routesBySource[currentAirport.id] || [];

			for (const connection of currentAirportConnections) {
				const distanceFromSource = distance + connection.distance;
				const destinationId = connection.destination.id;
				const currentSmallestDistance = shortestDistance[destinationId]?.distance;
				if (isNewSmallestDistance(distanceFromSource, currentSmallestDistance)) {
					shortestDistance[destinationId] = {
						distance: distance + connection.distance,
						hops: [...shortestDistance[currentAirport.id].hops, currentAirport.iata],
						previousNode: currentAirport,
					};
				}
			}

			unvisitedAirports.splice(currentAirportIndex, 1);
			visitedAirports.push(currentAirport.id);

			if (shortestDistance[currentAirport.id].hops.length < 2) {
				const setOfUnvisitedAirports = new Set([
					...unvisitedAirports,
					...currentAirportConnections
						.map((connection: Route) => connection.destination)
						.filter((airport: Airport) => !visitedAirports.includes(airport.id)),
				]);
				unvisitedAirports = Array.from(setOfUnvisitedAirports);
			}
		}
		
		console.log('......')
		const { distance, hops } = shortestDistance[destinationAirport.id] || {};
		console.log('🚀 ~ app.get ~ hops:', hops);

		return res.status(200).send({
			source,
			destination,
			distance,
			hops: [hops],
		});
	});

	return app;
}
