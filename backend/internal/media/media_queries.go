package media

const insertMediaQuery = `
	INSERT INTO media (
		owner_account_id,
		entity_type,
		entity_id,
		file_name,
		file_path,
		public_url,
		mime_type,
		size_bytes
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	RETURNING id, owner_account_id, entity_type, entity_id, file_name, file_path, public_url, mime_type, size_bytes, created_at, deleted_at
`

const selectMediaByIDQuery = `
	SELECT id, owner_account_id, entity_type, entity_id, file_name, file_path, public_url, mime_type, size_bytes, created_at, deleted_at
	FROM media
	WHERE id = $1
`

const softDeleteMediaQuery = `
	UPDATE media
	SET deleted_at = COALESCE(deleted_at, NOW())
	WHERE id = $1
	  AND deleted_at IS NULL
`

const softDeleteActiveEntityMediaQuery = `
	UPDATE media
	SET deleted_at = COALESCE(deleted_at, NOW())
	WHERE entity_type = $1
	  AND entity_id = $2
	  AND deleted_at IS NULL
`
