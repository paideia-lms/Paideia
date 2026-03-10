#!/usr/bin/env bun

/**
 * Visualizes all relationships between Payload collections and globals.
 * Generates a Mermaid diagram and outputs SVG to cwd (default: relationships.svg) and ASCII to console.
 *
 * Run: bun scripts/visualize-relationships.ts
 * Or:  bun scripts/visualize-relationships.ts --output diagram.svg
 */

import { renderMermaidASCII, renderMermaidSVG } from "beautiful-mermaid";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
	ActivityModuleGrants,
	ActivityModules,
	AssignmentSubmissions,
	Assignments,
	CategoryRoleAssignments,
	CourseActivityModuleLinks,
	CourseCategories,
	CourseGradeTables,
	CourseSections,
	Courses,
	DiscussionSubmissions,
	Discussions,
	Enrollments,
	Files,
	GradebookCategories,
	GradebookItems,
	Gradebooks,
	Groups,
	Media,
	Notes,
	Pages,
	QuizSubmissions,
	Quizzes,
	SystemGradeTable,
	UserGrades,
	Users,
	Whiteboards,
} from "../src/collections";
import {
	AnalyticsSettings,
	AppearanceSettings,
	MaintenanceSettings,
	RegistrationSettings,
	SitePolicies,
} from "../src/collections/globals";

interface Relationship {
	source: string;
	target: string;
	field: string;
	type: "relationship" | "join" | "upload";
}

function toMermaidId(slug: string): string {
	return slug.replace(/-/g, "_");
}

function extractRelationships(
	slug: string,
	fields: readonly unknown[],
): Relationship[] {
	const relationships: Relationship[] = [];

	const traverse = (fieldList: readonly unknown[], _prefix = "") => {
		for (const field of fieldList) {
			const f = field as Record<string, unknown>;
			const fieldType = f.type as string | undefined;
			const fieldName = (f.name as string) ?? "?";

			if (fieldType === "relationship" || fieldType === "upload") {
				const relationTo = f.relationTo;
				if (relationTo) {
					const targets = Array.isArray(relationTo) ? relationTo : [relationTo];
					for (const target of targets) {
						relationships.push({
							source: slug,
							target: target as string,
							field: fieldName,
							type: fieldType as "relationship" | "upload",
						});
					}
				}
			} else if (fieldType === "join") {
				const collection = f.collection as string | undefined;
				if (collection) {
					relationships.push({
						source: slug,
						target: collection,
						field: `${fieldName} (join)`,
						type: "join",
					});
				}
			} else if (fieldType === "array" && Array.isArray(f.fields)) {
				traverse(f.fields as readonly unknown[], fieldName);
			} else if (fieldType === "blocks" && Array.isArray(f.blocks)) {
				for (const block of f.blocks as readonly unknown[]) {
					const b = block as Record<string, unknown>;
					if (Array.isArray(b.fields)) {
						traverse(b.fields as readonly unknown[], fieldName);
					}
				}
			} else if (fieldType === "row" && Array.isArray(f.fields)) {
				traverse(f.fields as readonly unknown[], fieldName);
			} else if (fieldType === "collapsible" && Array.isArray(f.fields)) {
				traverse(f.fields as readonly unknown[], fieldName);
			} else if (fieldType === "tabs" && Array.isArray(f.tabs)) {
				for (const tab of f.tabs as readonly unknown[]) {
					const t = tab as Record<string, unknown>;
					if (Array.isArray(t.fields)) {
						traverse(t.fields as readonly unknown[], fieldName);
					}
				}
			}
		}
	};

	traverse(fields);
	return relationships;
}

const collections = [
	Users,
	Courses,
	CourseSections,
	CourseCategories,
	CategoryRoleAssignments,
	Enrollments,
	ActivityModules,
	ActivityModuleGrants,
	CourseActivityModuleLinks,
	Pages,
	Whiteboards,
	Assignments,
	Quizzes,
	Discussions,
	Media,
	Notes,
	Gradebooks,
	GradebookCategories,
	GradebookItems,
	AssignmentSubmissions,
	QuizSubmissions,
	DiscussionSubmissions,
	CourseGradeTables,
	Groups,
	UserGrades,
	Files,
] as const;

const globals = [
	SystemGradeTable,
	RegistrationSettings,
	MaintenanceSettings,
	SitePolicies,
	AppearanceSettings,
	AnalyticsSettings,
] as const;

function buildMermaidDiagram(): string {
	const allRelationships: Relationship[] = [];
	const collectionSlugs = new Set<string>();
	const globalSlugs = new Set<string>();

	for (const coll of collections) {
		const slug = coll.slug as string;
		collectionSlugs.add(slug);
		const fields = (coll as { fields?: readonly unknown[] }).fields ?? [];
		allRelationships.push(...extractRelationships(slug, fields));
	}

	for (const g of globals) {
		const slug = g.slug as string;
		globalSlugs.add(slug);
		const fields = (g as { fields?: readonly unknown[] }).fields ?? [];
		allRelationships.push(...extractRelationships(slug, fields));
	}

	// Deduplicate edges (same source, target, field) to avoid Mermaid clutter
	const edgeKey = (r: Relationship) => `${r.source}->${r.target}:${r.field}`;
	const seen = new Set<string>();
	const uniqueRelationships = allRelationships.filter((r) => {
		const k = edgeKey(r);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});

	const lines: string[] = [
		"%% Payload Collections & Globals - Relationship Diagram",
		"%% Generated by scripts/visualize-relationships.ts",
		"",
		"flowchart TB",
		"",
		"  subgraph Collections[Collections]",
	];

	for (const slug of [...collectionSlugs].sort()) {
		const id = toMermaidId(slug);
		lines.push(`    ${id}["${slug}"]`);
	}

	lines.push("  end", "");

	if (globalSlugs.size > 0) {
		lines.push("  subgraph Globals[Globals]");
		for (const slug of [...globalSlugs].sort()) {
			const id = toMermaidId(slug);
			lines.push(`    ${id}["${slug}"]`);
		}
		lines.push("  end", "");
	}

	// Add relationships - only include if target exists
	const validTargets = new Set([...collectionSlugs, ...globalSlugs]);
	for (const r of uniqueRelationships) {
		if (!validTargets.has(r.target)) continue;
		const srcId = toMermaidId(r.source);
		const tgtId = toMermaidId(r.target);
		const label = r.field.length > 25 ? r.field.slice(0, 22) + "..." : r.field;
		const safeLabel = label.replace(/"/g, "'");
		lines.push(`  ${srcId} -->|"${safeLabel}"| ${tgtId}`);
	}

	return lines.join("\n");
}

function main(): void {
	const args = process.argv.slice(2);
	const outputIdx = args.indexOf("--output");
	const outputPath =
		outputIdx >= 0 && args[outputIdx + 1]
			? args[outputIdx + 1]
			: "relationships.svg";

	const mermaid = buildMermaidDiagram();
	const svg = renderMermaidSVG(mermaid);
	// const ascii = renderMermaidASCII(mermaid);

	// write svg to cwd
	const absPath = path.resolve(process.cwd(), outputPath ?? "");
	writeFileSync(absPath, svg, "utf-8");
	console.error(`SVG written to ${absPath}`);
	// console.log("\n" + ascii);
}

main();
