const SIGNUP_ALLOWED_EMAIL_DOMAINS_ENV = "SIGNUP_ALLOWED_EMAIL_DOMAINS";

function normalizeDomain(domain: string) {
	let trimmed = domain.trim().toLowerCase();
	if (!trimmed) {
		return null;
	}

	// Allow values like `"example.com"` or `'example.com'` coming from env files / UIs.
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		trimmed = trimmed.slice(1, -1).trim();
	}

	if (!trimmed) {
		return null;
	}

	return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function getEmailDomain(email: string | null | undefined) {
	if (!email) {
		return null;
	}
	const trimmed = email.trim().toLowerCase();
	const atIndex = trimmed.lastIndexOf("@");
	if (atIndex === -1 || atIndex === trimmed.length - 1) {
		return null;
	}
	return trimmed.slice(atIndex + 1);
}

function getAllowedSignupDomains() {
	const raw = process.env[SIGNUP_ALLOWED_EMAIL_DOMAINS_ENV];
	if (!raw) {
		return null;
	}
	const domains = raw
		.split(",")
		.map((domain) => normalizeDomain(domain))
		.filter((domain): domain is string => Boolean(domain));
	if (domains.length === 0) {
		return null;
	}
	return new Set(domains);
}

export function isSignupEmailAllowed(email: string | null | undefined) {
	const allowedDomains = getAllowedSignupDomains();
	if (!allowedDomains) {
		return true;
	}
	const domain = getEmailDomain(email);
	if (!domain) {
		return false;
	}
	return allowedDomains.has(domain);
}
