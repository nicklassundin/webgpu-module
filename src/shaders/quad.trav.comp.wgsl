
struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	done: u32,
	_pad: vec2<i32>,
};
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

@group(0) @binding(0) var<storage, read_write> traversal: array<Traversal>;
@group(0) @binding(1) var<storage, read_write> values: array<f32>;
@group(0) @binding(2) var<storage, read_write> nodes: array<f32>;

@group(0) @binding(3) var<storage, read_write> result: array<array<f32, 16>>;

// Parent addresses
struct addrInfo {
	address: array<f32,16>,
	iter: array<i32>,
};
@group(1) @binding(0) var<storage, read_write> addr: addrInfo;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let threadIndex = local_id.x;
	let iter = addr.iter[threadIndex];
	let id: u32 = u32(iter % 15i);
	let trav = traversal[id];
	if (trav.done == 0u){
		addr.iter[threadIndex] = addr.iter[threadIndex] + 1i;	
		addr.address[0] = trav.address;
		return;
	}

	var pTrav = traversal[id-1];
	let quad = trav.quad;
	
	let node = getNode(u32(pTrav.address));
	var child = node.children[quad];
		
	if(child < 0.0 || ((pTrav.address == 0.0) && (id > 1u))) {
		result[threadIndex][id] = 0.0;
		addr.iter[threadIndex] += 1i; 
		return;
	}
	result[threadIndex][id] = values[u32(child)] / values[0];
	
	traversal[id].address = child;
	traversal[id].done = 0u;
	addr.iter[threadIndex] = addr.iter[threadIndex] + 1i;
}
