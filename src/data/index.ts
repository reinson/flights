import * as parse from 'csv-parse';
import { readFile } from 'fs';
import { resolve as resolvePath } from 'path';

import { notNil, haversine } from '../util';

export interface Airport {
	id: string;
	icao: string | null;
	iata: string | null;
	name: string;
	location: {
		latitude: number;
		longitude: number;
	};
}

export interface Route {
	source: Airport;
	destination: Airport;
	distance: number;
	groundHopFrom?: Airport
}

interface AirportsGroundConnections {
	[id: Airport['id']]: {
		airport: Airport;
		distance: number;
	}[];
};

function parseCSV<T extends Readonly<string[]>>(
	filePath: string,
	columns: T,
): Promise<{ [key in T[number]]: string }[]> {
	return new Promise((resolve, reject) => {
		readFile(filePath, (err, data) => {
			if (err) {
				return reject(err);
			}

			parse(
				data,
				{ columns: Array.from(columns), skip_empty_lines: true, relax_column_count: true },
				(err, rows) => {
					if (err) {
						return reject(err);
					}

					resolve(rows);
				},
			);
		});
	});
}

export async function loadAirportData(): Promise<Airport[]> {
	const columns = ['airportID', 'name', 'city', 'country', 'iata', 'icao', 'latitude', 'longitude'] as const;
	const rows = await parseCSV(resolvePath(__dirname, './airports.dat'), columns);

	return rows.map((row) => ({
		id: row.airportID,
		icao: row.icao === '\\N' ? null : row.icao,
		iata: row.iata === '\\N' ? null : row.iata,
		name: row.name,
		location: {
			latitude: Number(row.latitude),
			longitude: Number(row.longitude),
		},
	}));
}

const removeRouteDuplicates = (routes: Route[]) => {
	const existingKeys = new Set();
	const cleanedRoutes = [];

	routes.forEach((route: Route): void => {
		const routeId = `${route.source.id}-${route.destination.id}`;
		if (!existingKeys.has(routeId)) {
			existingKeys.add(routeId);
			cleanedRoutes.push(route);
		}
	});

	return cleanedRoutes;
};

export async function loadRouteData(): Promise<Route[]> {
	const airports = await loadAirportData();
	const airportsById = new Map<string, Airport>(airports.map((airport) => [airport.id, airport] as const));

	const columns = [
		'airline',
		'airlineID',
		'source',
		'sourceID',
		'destination',
		'destinationID',
		'codeshare',
		'stops',
	] as const;
	const rows = await parseCSV(resolvePath(__dirname, './routes.dat'), columns);

	const routes = rows
		.filter((row) => row.stops === '0')
		.map((row) => {
			const source = airportsById.get(row.sourceID);
			const destination = airportsById.get(row.destinationID);

			if (source === undefined || destination === undefined) {
				return null;
			}

			return {
				source,
				destination,
				distance: haversine(
					source.location.latitude,
					source.location.longitude,
					destination.location.latitude,
					destination.location.longitude,
				),
			};
		})
		.filter(notNil);

	return removeRouteDuplicates(routes);
}

export type GroupedRoutesBySource = {
	[id: Airport['id']]: Route[];
};

export const groupRoutesBySource = (routes: Route[]): GroupedRoutesBySource => {
	const groupedRoutes = routes.reduce<GroupedRoutesBySource>((groupedRoutes, route) => {
		if (!groupedRoutes[route.source.id]) {
			groupedRoutes[route.source.id] = [];
		}

		groupedRoutes[route.source.id].push(route);

		return groupedRoutes;
	}, {});

	for (const sourceId in groupedRoutes) {
		groupedRoutes[sourceId] = groupedRoutes[sourceId].sort((a, b) => a.distance - b.distance);
	}

	return groupedRoutes;
};

export const findAirportGroundConnections = (airports: Airport[]) => {
	const airportGroundConnections: AirportsGroundConnections = airports.reduce((acc, airport: Airport) => {
		acc[airport.id] = [];

		return acc;
	}, {});

	airports.forEach((a1: Airport, index) => {
		for (const a2 of airports.slice(index + 1)) {
			const distance = haversine(
				a1.location.latitude,
				a1.location.longitude,
				a2.location.latitude,
				a2.location.longitude,
			);
			if (distance <= 100) {
				airportGroundConnections[a1.id].push({ airport: a2, distance });
				airportGroundConnections[a2.id].push({ airport: a1, distance });
			}
		}
	});

	return airportGroundConnections;
};

export const addOverGroundRoutes = (routes: Route[], airportGroundConnections: AirportsGroundConnections) => {
	const allRoutes: Route[] = [...routes];

	routes.forEach((route: Route) => {
		const destinationGroundConnections = airportGroundConnections[route.destination.id];
		destinationGroundConnections.forEach(({ airport, distance }) => {
			allRoutes.push({
				...route,
				destination: airport,
				distance: distance + route.distance,
				groundHopFrom: route.destination,
			});
		});
	});

	return allRoutes;
};

export const prepareRoutesData = (routes: Route[], airports: Airport[]) => {
	const airportsGroundConnections = findAirportGroundConnections(airports);
	const routesWithGroundHops = addOverGroundRoutes(routes, airportsGroundConnections);

	const routesBySource = groupRoutesBySource(routes);
	const routesBySourceWithGroundHops = groupRoutesBySource(routesWithGroundHops);

	return { routesBySource, routesBySourceWithGroundHops };
};
