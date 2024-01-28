import * as request from 'supertest';

import { createApp } from '../index';

const TIMEOUT = 10_000;

let server: Express.Application;

describe('server', () => {
	beforeAll(async () => {
		server = await createApp();
	});

	describe('shortest route', () => {
		it(
			'correctly routes from TLL to SFO without ground hops',
			async () => {
				// https://www.greatcirclemap.com/?routes=TLL-TRD-KEF-YEG-SFO
				const response = await request(server).get('/routes/TLL/SFO');
				const body = response.body;

				expect(body.distance).toBeWithin(8900, 9400);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'TLL',
						destination: 'SFO',
					}),
				);
				expect([['TLL', 'TRD', 'KEF', 'YEG', 'SFO']]).toContainEqual(body.hops);
			},
			TIMEOUT,
		);

		it(
			'correctly routes from HAV to TAY',
			async () => {
				// https://www.greatcirclemap.com/?routes=%20HAV-NAS-JFK-HEL-TAY
				const response = await request(server).get('/routes/HAV/TAY');
				const body = response.body;

				expect(body.distance).toBeWithin(9100, 9200);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'HAV',
						destination: 'TAY',
						hops: ['HAV', 'NAS', 'JFK', 'HEL', 'TAY'],
					}),
				);
			},
			TIMEOUT,
		);

		it(
			'correctly routes from HAV to TAY in five hops',
			async () => {
				// https://www.greatcirclemap.com/?routes=%20HAV-NAS-BOS-KEF-HEL-TAY
				const response = await request(server).get('/routes/HAV/TAY?allowed_hops=5');
				const body = response.body;

				expect(body.distance).toBeWithin(9100, 9200);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'HAV',
						destination: 'TAY',
						hops: ['HAV', 'NAS', 'BOS', 'KEF', 'HEL', 'TAY'],
					}),
				);
			},
			TIMEOUT,
		);

		it(
			'correctly routes from HAV to TAY in three hops',
			async () => {
				// https://www.greatcirclemap.com/?routes=%20HAV-AMS-HEL-TAY
				const response = await request(server).get('/routes/HAV/TAY?allowed_hops=3');
				const body = response.body;

				expect(body.distance).toBeWithin(9500, 9600);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'HAV',
						destination: 'TAY',
						hops: ['HAV', 'AMS', 'HEL', 'TAY'],
					}),
				);
			},
			TIMEOUT,
		);

		it(
			'responds with 404 if airports are not connected in allowed hops count',
			async () => {
				const allowedHops = 2;
				const response = await request(server).get('/routes/HAV/TAY?allowed_hops=' + allowedHops);
				const body = response.body;

				expect(response.status).toBe(404);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'HAV',
						destination: 'TAY',
						allowed_hops: allowedHops,
						message: 'not connected in allowed hops count',
					}),
				);
			},
			TIMEOUT,
		);
	});

	describe('routes extended via ground', () => {
		it(
			'correctly routes from TLL to SFO with ground hops',
			async () => {
				// https://www.greatcirclemap.com/?routes=TLL-ARN-OAK-SFO
				const response = await request(server).get('/routes/TLL/SFO?with-ground-hops');
				const body = response.body;

				expect(body.distance).toBeWithin(8900, 9050);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'TLL',
						destination: 'SFO',
					}),
				);
				expect([['TLL', 'ARN', 'OAK', 'SFO']]).toContainEqual(body.hops);
			},
			TIMEOUT,
		);

		it(
			'correctly routes from TLL to LHR with ground hops',
			async () => {
				// https://www.greatcirclemap.com/?routes=TLL-STN-LHR
				const response = await request(server).get('/routes/TLL/LHR?with-ground-hops');
				const body = response.body;

				expect(body.distance).toBeWithin(1800, 1850);
				expect(body).toEqual(
					expect.objectContaining({
						source: 'TLL',
						destination: 'LHR',
						hops: ['TLL', 'STN', 'LHR'],
					}),
				);
			},
			TIMEOUT,
		);
	});
});
