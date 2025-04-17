
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};


fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 6u],
		vec4<f32>(nodes[index * 6u + 1u], nodes[index * 6u + 2u], nodes[index * 6u + 3u], nodes[index * 6u + 4u]),
		nodes[index * 6u + 5u]
	);
	return node;
}

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	_pad: vec3<i32>,
};


@group(0) @binding(0) var<storage, read_write> traversal: array<Traversal>;
@group(0) @binding(1) var<storage, read_write> values: array<f32>;
@group(0) @binding(2) var<storage, read_write> nodes: array<f32>;

@group(0) @binding(3) var<storage, read_write> result: array<f32>;


//@compute @workgroup_size(1)
@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	//let id = local_id.x + local_id.y * 4u + global_id.z * 16u;
	let id = local_id.x + local_id.y * 4u + 16u * ((global_id.z+1u) / 16u - 1u); 
	
	let pTrav = traversal[id];
	var trav = traversal[id+1];
	let quad = trav.quad;


	var child = getNode(u32(pTrav.address)).children[quad];

	trav.address = f32(child); 
	trav.quad = i32(getNode(u32(child)).quad);
	trav.depth = pTrav.depth + 1.0;
	if(child < 0.0) {
		traversal[id+1].address = 0.0;
		return;
	}
	traversal[id+1] = trav;

	result[u32(pTrav.depth)+1] = values[u32(child)] / values[0];
	//result[u32(pTrav.depth)+1] = trav.address;
}
