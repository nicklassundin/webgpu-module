struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};

fn getTraversal(address: u32) -> Traversal {
	var trav: Traversal;
	let index = address*10;
	trav.depth = traversal[index]; 
	trav.boundBox = vec4<f32>(traversal[index + 1], traversal[index + 2], traversal[index + 3], traversal[index + 4]);
	trav.coord = vec4<f32>(traversal[index + 5], traversal[index + 6], traversal[index + 7], traversal[index + 8]);
	trav.address = traversal[index + 9];
	return trav;
};

@group(2) @binding(0) var<storage, read> levelValues: array<f32>;
@group(2) @binding(1) var<storage, read> traversal: array<f32>;

const GRID: u32 = 10; 
@vertex
fn main(@builtin(vertex_index) VertexIndex : u32,
@location(0) position: vec4<f32>,
) -> @builtin(position) vec4f {
	return position;
}
