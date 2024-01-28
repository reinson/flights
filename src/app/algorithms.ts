import { Airport, GroupedRoutesBySource } from '../data';

type ShortestDistanceTable = {
	[airportId: Airport['id']]: {
		distance: number;
		hops: Airport[];
	};
};

const isNewSmallestDistance = (distanceFromSource: number, currentSmallest?: number) =>
	!currentSmallest || distanceFromSource < currentSmallest;

export const dijkstra = (sourceAirport: Airport, airports: Airport[], routesBySource: GroupedRoutesBySource) => {
	const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
		unvisitedAirports.reduce((currentMin, airport, index) => {
			const tableEntry = shortestDistanceTable[airport.id];

			if (tableEntry?.distance === undefined) {
				return currentMin;
			}

			if (!currentMin.distance || currentMin.distance > tableEntry.distance) {
				return { distance: tableEntry.distance, airport, index };
			}

			return currentMin;
		}, {} as { distance: number; airport: Airport; index: number });

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
					hops: [...shortestDistance[currentAirport.id].hops, currentAirport],
				};
			}
		}

		unvisitedAirports.splice(currentAirportIndex, 1);
	}

	return shortestDistance;
};

export const bruteForce = (
	sourceAirport: Airport,
	allowedHops: number,
	routesBySource: GroupedRoutesBySource,
	dijkstraShortestDistance: ShortestDistanceTable,
) => {
	const shortestDistance: ShortestDistanceTable = {
		[sourceAirport.id]: {
			distance: 0,
			hops: [],
		},
	};

	const unfinishedTravels: { distance: number; hops: Airport[] }[] = [{ distance: 0, hops: [sourceAirport] }];

	while (unfinishedTravels.length > 0) {
		const travelToExtend = unfinishedTravels.pop();
		const currentTravelEnd = travelToExtend.hops[travelToExtend.hops.length - 1];
		const connectionsFromEnd = routesBySource[currentTravelEnd.id];

		if (!connectionsFromEnd) {
			continue;
		}

		for (const connection of connectionsFromEnd) {
			const destinationId = connection.destination.id;
			const distanceFromSource = travelToExtend.distance + connection.distance;
			const currentSmallestDistance = shortestDistance[destinationId]?.distance;
			const hopsToConnectionEnd = [...travelToExtend.hops, connection.destination];

			if (isNewSmallestDistance(distanceFromSource, currentSmallestDistance)) {
				shortestDistance[destinationId] = {
					distance: distanceFromSource,
					hops: hopsToConnectionEnd,
				};
			}

			const { hops: dijkstraHops, distance: dijkstraDistance } = dijkstraShortestDistance[destinationId];
			const dijkstraHopsWithDestination = dijkstraHops.length + 1;

			if (
				hopsToConnectionEnd.length <= allowedHops &&
				(dijkstraHopsWithDestination > hopsToConnectionEnd.length || dijkstraDistance === distanceFromSource)
			) {
				unfinishedTravels.push({
					distance: distanceFromSource,
					hops: hopsToConnectionEnd,
				});
			}
		}
	}

	return shortestDistance;
};
