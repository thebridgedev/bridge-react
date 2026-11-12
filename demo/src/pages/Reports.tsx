// Reached only while the `reports` flag is on: the route rule in App.tsx.
export function Reports() {
	return (
		<>
			<h1 data-testid="reports-page">Reports</h1>
			<p>
				Only people the <code>reports</code> flag lets in see this page.
			</p>
		</>
	);
}
