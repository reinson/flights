import { Airport, GroupedRoutesBySource, Route } from '../data';

type ShortestDistanceTable = {
	[airportId: Airport['id']]: {
		distance: number;
		hops: Route[];
	};
};

export enum Algorithm {
	BruteForce = 'force',
	BruteForcePlus = 'plus',
	BruteForceDijkstra = 'dijkstra',
}

type Travel = { distance: number; location: Airport['id']; hops: Route[] };

const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
	unvisitedAirports.reduce<{ distance: number; airport: Airport; index: number } | null>(
		(currentMin, airport, index) => {
			const { distance } = shortestDistanceTable[airport.id];

			if (!currentMin || currentMin.distance > distance) {
				return { distance, airport, index };
			}

			return currentMin;
		},
		null,
	);

export const dijkstra = (sourceAirport: Airport, airports: Airport[], routesBySource: GroupedRoutesBySource) => {
	const unvisitedAirports: Airport[] = [...airports];

	const shortestDistances: ShortestDistanceTable = Object.fromEntries(
		airports.map((a) => [a.id, { distance: a.id === sourceAirport.id ? 0 : Infinity, hops: [] }]),
	);

	while (unvisitedAirports.length) {
		const {
			distance,
			airport: currentAirport,
			index: currentAirportIndex,
		} = selectNextAirportToVisit(shortestDistances, unvisitedAirports);

		unvisitedAirports.splice(currentAirportIndex, 1);

		const currentAirportConnections = routesBySource[currentAirport.id] || [];

		for (const connection of currentAirportConnections) {
			const distanceFromSource = distance + connection.distance;
			const destinationId = connection.destination.id;
			const currentSmallestDistance = shortestDistances[destinationId]?.distance;

			if (distanceFromSource < currentSmallestDistance) {
				shortestDistances[destinationId] = {
					distance: distanceFromSource,
					hops: [...shortestDistances[currentAirport.id].hops, connection],
				};
			}
		}
	}

	return shortestDistances;
};

export const findShortestDistances = (
	sourceAirport: Airport,
	allowedHops: number,
	routesBySource: GroupedRoutesBySource,
	airports: Airport[],
	algorithm: Algorithm = Algorithm.BruteForcePlus,
) => {
	const dijkstraShortestDistance =
		algorithm === Algorithm.BruteForceDijkstra && dijkstra(sourceAirport, airports, routesBySource);

	const shortestDistances: ShortestDistanceTable = Object.fromEntries(
		airports.map((a) => [a.id, { distance: a.id === sourceAirport.id ? 0 : Infinity, hops: [] }]),
	);

	const unfinishedTravels: Travel[] = [{ distance: 0, location: sourceAirport.id, hops: [] }];

	const shouldExtendTravel = {
		[Algorithm.BruteForce]: (travel: Travel) => travel.hops.length < allowedHops,

		[Algorithm.BruteForcePlus]: (travel: Travel) => {
			const { distance: currentSmallestDistance, hops: currentSmallestHops } = shortestDistances[travel.location];

			return (
				shouldExtendTravel[Algorithm.BruteForce](travel) &&
				(travel.distance < currentSmallestDistance || travel.hops.length < currentSmallestHops.length)
			);
		},

		[Algorithm.BruteForceDijkstra]: (travel: Travel) => {
			const { hops: dijkstraHops, distance: dijkstraDistance } = dijkstraShortestDistance[travel.location];

			return (
				shouldExtendTravel[Algorithm.BruteForcePlus](travel) &&
				(dijkstraHops.length > travel.hops.length || dijkstraDistance === travel.distance)
			);
		},
	};

	while (unfinishedTravels.length > 0) {
		const travelToExtend = unfinishedTravels.pop();
		const connectionsFromTravelEnd = routesBySource[travelToExtend.location] || [];

		for (const connection of connectionsFromTravelEnd) {
			const newTravel = {
				distance: travelToExtend.distance + connection.distance,
				location: connection.destination.id,
				hops: [...travelToExtend.hops, connection],
			};

			if (shouldExtendTravel[algorithm](newTravel)) {
				unfinishedTravels.push(newTravel);
			}

			if (newTravel.distance < shortestDistances[newTravel.location].distance) {
				shortestDistances[newTravel.location] = {
					distance: newTravel.distance,
					hops: newTravel.hops,
				};
			}
		}
	}

	return shortestDistances;
};

export const readAlgoFromQuery = (input: string): Algorithm => {
	switch (input) {
		case Algorithm.BruteForce: 
			return Algorithm.BruteForce
		case Algorithm.BruteForceDijkstra:
			return Algorithm.BruteForceDijkstra
		default:
			return Algorithm.BruteForcePlus
	}
}
