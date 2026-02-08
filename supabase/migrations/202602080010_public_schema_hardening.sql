-- Security Advisor: prevent unprivileged roles from creating objects in `public` schema.

revoke create on schema public from public;

