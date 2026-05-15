export function apiError(
	status: number,
	code: string,
	message: string,
): Response {
	return new Response(
		JSON.stringify({
			error: {
				code,
				message,
			},
		}),
		{
			status,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
}
