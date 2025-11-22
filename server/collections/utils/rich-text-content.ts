export function richTextContent<T extends { type: "textarea" }>(o: T) {
	return [
		o,
		{
			name: "media",
			type: "relationship",
			relationTo: "media",
			hasMany: true,
			label: "Media",
		},
	] as const;
}
