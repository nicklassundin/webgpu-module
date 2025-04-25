
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


@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	
	let id = global_id.x + global_id.y * 4u;
	let pTrav = traversal[id];
	if (id == 0u){
		result[0] = 1.0;
		return;
	}else if (u32(pTrav.depth) != id){
		return;
	}

	var trav = traversal[id+1];
	let quad = trav.quad;

	var child = getNode(u32(pTrav.address)).children[quad];

	traversal[id+1].address = f32(child); 
	if(child < 0.0) {
		return;
	}
	result[u32(pTrav.depth)] = values[u32(child)] / values[0];
	//result[u32(pTrav.depth)+1] = values[u32(child)];
}
