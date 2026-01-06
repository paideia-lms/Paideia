import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconPlusMinus } from "@tabler/icons-react";

export function WeightDisplay({
	weight,
	adjustedWeight,
	extraCredit,
	isCategory = false,
	autoWeightedZero = false,
}: {
	weight: number | null;
	adjustedWeight: number | null;
	extraCredit?: boolean;
	isCategory?: boolean;
	autoWeightedZero?: boolean;
}) {
	const hasWeight = weight !== null;
	const hasAdjustedWeight = adjustedWeight !== null;
	const weightsMatch =
		hasWeight && hasAdjustedWeight && Math.abs(weight - adjustedWeight) < 0.01;

	let displayText: string;
	let tooltipContent: React.ReactNode;

	// Special handling for auto-weighted-0 categories
	if (autoWeightedZero && isCategory && !hasWeight) {
		displayText = "auto (0%)";
		tooltipContent = (
			<Stack gap="xs">
				<div>
					<Text size="xs" fw={700}>
						No weight specified
					</Text>
				</div>
				<div>
					<Text size="xs">
						This category has no non-extra-credit items and is treated as 0%
						weight. It does not participate in weight distribution.
					</Text>
				</div>
			</Stack>
		);
	} else if (hasWeight && hasAdjustedWeight) {
		if (weightsMatch) {
			displayText = `${weight.toFixed(2)}%`;
			tooltipContent = (
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Specified weight: {weight.toFixed(2)}%
						</Text>
					</div>
					<div>
						<Text size="xs">Adjusted weight: {adjustedWeight.toFixed(2)}%</Text>
					</div>
				</Stack>
			);
		} else {
			displayText = `${weight.toFixed(2)}% (${adjustedWeight.toFixed(2)}%)`;
			tooltipContent = (
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Specified weight: {weight.toFixed(2)}%
						</Text>
					</div>
					<div>
						<Text size="xs">Adjusted weight: {adjustedWeight.toFixed(2)}%</Text>
					</div>
					<div>
						<Text size="xs">
							The adjusted weight is different from the specified weight because
							weights are distributed to sum to 100% at this level.
						</Text>
					</div>
				</Stack>
			);
		}
	} else if (!hasWeight && hasAdjustedWeight) {
		displayText = `auto (${adjustedWeight.toFixed(2)}%)`;
		tooltipContent = (
			<Stack gap="xs">
				<div>
					<Text size="xs" fw={700}>
						No weight specified
					</Text>
				</div>
				<div>
					<Text size="xs">Adjusted weight: {adjustedWeight.toFixed(2)}%</Text>
				</div>
				<div>
					<Text size="xs">
						This weight was automatically calculated to ensure all weights sum
						to 100% at this level.
					</Text>
				</div>
			</Stack>
		);
	} else {
		displayText = "auto (0%)";
		tooltipContent = (
			<Stack gap="xs">
				<div>
					<Text size="xs">No weight specified</Text>
				</div>
				<div>
					<Text size="xs">No adjusted weight calculated</Text>
				</div>
			</Stack>
		);
	}

	// Build the weight display content
	const weightContent = (
		<Group gap={4} align="center" wrap="nowrap">
			<Text size="sm">{displayText}</Text>
			{extraCredit && (
				<Tooltip
					label={
						<Stack gap="xs">
							<Text size="xs" fw={700}>
								Extra Credit
							</Text>
							<Text size="xs">
								{isCategory
									? "This category is marked as extra credit. Extra credit categories do not participate in weight distribution and allow the total to exceed 100%."
									: "This item is marked as extra credit. Extra credit items do not participate in weight distribution and allow categories to total above 100%."}
							</Text>
						</Stack>
					}
					withArrow
					multiline
					w={300}
				>
					<IconPlusMinus size={16} style={{ cursor: "help" }} />
				</Tooltip>
			)}
		</Group>
	);

	// Always show tooltip if adjusted weight exists and is different from weight, or if auto-weighted-0
	if (
		autoWeightedZero ||
		(hasAdjustedWeight && (!hasWeight || !weightsMatch))
	) {
		return (
			<Tooltip label={tooltipContent} withArrow multiline w={300}>
				<Box style={{ cursor: "help" }}>{weightContent}</Box>
			</Tooltip>
		);
	}

	return weightContent;
}

export function OverallWeightDisplay({
	overallWeight,
	weightExplanation,
	extraCredit,
}: {
	overallWeight: number | null;
	weightExplanation: string | null;
	extraCredit?: boolean;
}) {
	if (overallWeight === null) {
		return <Text size="sm">0%</Text>;
	}

	return (
		<Tooltip
			label={
				<Stack gap="xs">
					<div>
						<Text size="xs" fw={700}>
							Effective weight: {overallWeight.toFixed(2)}% of course
						</Text>
					</div>
					{weightExplanation ? (
						<div>
							<Text size="xs" fw={700} mb={4}>
								Calculation:
							</Text>
							<Text size="xs">{weightExplanation}</Text>
						</div>
					) : (
						<Text size="xs">
							This is the effective weight of this item in the overall course
							grade calculation.
						</Text>
					)}
				</Stack>
			}
			withArrow
			multiline
			w={400}
		>
			<Group>
				<Text size="sm" style={{ cursor: "help" }}>
					{overallWeight.toFixed(2)}%
				</Text>

				{/* {extraCredit && (
					<IconPlusMinus size={16} style={{ cursor: "help" }} />
				)} */}
			</Group>
		</Tooltip>
	);
}
