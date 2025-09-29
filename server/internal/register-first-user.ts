import { commitTransaction, type Payload } from "payload";

export async function registerFirstUser(
	payload: Payload,
	request: Request,
	args: {
		email: string;
		password: string;
		firstName: string;
		lastName: string;
		// ! first user is always admin
	},
) {
	const { email, password, firstName, lastName } = args;

	const newUser = await payload.create({
		collection: "users",
		data: {
			email,
			password,
			firstName,
			lastName,
			// ! it will always be admin
			role: "admin",
		},
		overrideAccess: true,
		req: request,
	});

	// auto verify
	await payload.update({
		id: newUser.id,
		collection: "users",
		data: {
			_verified: true,
		},
		req: request,
	});

	// /////////////////////////////////////
	// Log in new user
	// /////////////////////////////////////

	const { exp, token } = await payload.login({
		collection: "users",
		req: request,
		data: {
			email,
			password,
		},
	});

	const result = {
		...newUser,
		exp,
		token,
		_strategy: "local-jwt",
		collection: "users",
	};

	return result;
}
