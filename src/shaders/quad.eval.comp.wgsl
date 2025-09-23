
struct Node {
valueAddress: f32,
		      children: vec4<f32>,	
		      quad: f32
};

struct Traversal {
	coord: vec2<f32>,
	address0: f32,
	address1: f32,

};

struct ThreadInfo {
		reference: array<f32, 16>,
		dimensions: vec2<u32>,
		minLevel: u32,
};

fn normalizeArray16(arr: array<f32, 16>) -> array<f32, 16> {
	var normalized: array<f32, 16>;
	var maxVal = arr[0];
	for (var i = 1u; i < 16u; i = i + 1u) {
		if (arr[i] > maxVal) {
			maxVal = arr[i];
		}
	}
	for (var i = 0u; i < 16u; i = i + 1u) {
		normalized[i] = arr[i] / maxVal;
	}
	return normalized;
}


fn setReference(level: u32, value: f32) {
	if (level < 16u) {
		threadIterations.reference[level] = value;
	}
	// reference vector
	threadIterations.reference = normalizeArray16(threadIterations.reference);
}


fn getNode0(index: u32) -> Node {
	let node: Node = Node(nodes0[index * 6u],
			vec4<f32>(nodes0[index * 6u + 1u], nodes0[index * 6u + 2u], nodes0[index * 6u + 3u], nodes0[index * 6u + 4u]),
			nodes0[index * 6u + 5u]
			);
	
	return node;
}

fn getNode1(index: u32) -> Node {
	let node: Node = Node(nodes1[index * 6u],
			vec4<f32>(nodes1[index * 6u + 1u], nodes1[index * 6u + 2u], nodes1[index * 6u + 3u], nodes1[index * 6u + 4u]),
			nodes1[index * 6u + 5u]
			);
	
	return node;
}

fn getNodes(i: u32, j: u32) -> array<Node, 2> {
	return array<Node, 2>(getNode0(i), getNode1(j));
}

fn quadFromCoord(uv: vec2<f32>, textDim: vec2<u32>) -> u32 {
	if(textDim.x == 1u && textDim.y == 1u) {
		return 0u;
	}
	//let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(1.0 - uv.y, uv.x));
	let quadCoord = pixCoord % 2u;
	let quad = quadCoord.x *2u + quadCoord.y;
	return u32(quad);
}

fn getLevelIndex(level: u32) -> u32 {
	//return (4**level - 1) / 3;
	return u32(pow(4.0, f32(level)) - 1.0) / 3u;
}


fn getNodeIndex(level: u32, coord: vec2<u32>) -> u32 {
	let parentIndex = getLevelIndex(level);
	let grid_size = u32(pow(2.0, f32(level)));
	let y = coord[0];
	let x = coord[1];

	let index = coord[0] * grid_size + coord[1];

	
	let minLevel = threadIterations.minLevel;
	let offset = u32(pow(4.0, f32(minLevel)));	

	return parentIndex+index - offset;
}

fn getValue0(node: Node) -> f32 {
	return values0[u32(node.valueAddress)];
}

fn getValue1(node: Node) -> f32 {
	return values1[u32(node.valueAddress)];
}
fn getValues(node0: Node, node1: Node) -> vec2<f32> {
	return vec2<f32>(getValue0(node0), getValue1(node1));
}

// check quadMap level of all is done
fn checkQuadMapLevelDone(index: u32, coord: vec2<u32>, node: Node) -> bool {
	let mipLevelLeft = i32(index);
	if (mipLevelLeft <= 1){
		return true;
	}
	for (var i = 0u; i < 4u; i = i + 1u) {
		if(node.children[i] <= 0.0) {
			continue;
		}

		let quad = vec2<u32>(i / 2u, i % 2u);
		let pixCoord = 2u * vec2<u32>(coord) + quad;
		let nodeIndex = getNodeIndex(index+1, pixCoord);
		let quadBool = get_bit(nodeIndex);
		//if quadMap[nodeIndex] == 0u {
		if !quadBool {
			return false;
		}

	}
	return true;
}

fn writeTexture(coord: vec2<f32>, value: f32, index : u32, workgroup: vec3<u32>, local_id: vec3<u32>) {
	let workgroupsize = f32(threadIterations.dimensions.x);
	var color = vec4<f32>(value, f32(workgroup.x)/workgroupsize, f32(workgroup.y)/workgroupsize, 1.0);
	
	let textDim = textureDimensions(texture);
	let textCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));
	textureStore(texture, textCoord, color);
}


struct BitArray {
	data: array<u32>
};

fn get_bit(n: u32) -> bool {
	let word = n / 32u;
	let bit = n % 32u;
	return (quadMap.data[word] & (1u << bit)) != 0u;
}
fn set_bit(n: u32, value: bool) {
	let word = n / 32u;
	let bit = n % 32u;
	let mask = 1u << bit;

	if value {
		quadMap.data[word] |= mask;
	} else {
		quadMap.data[word] &= ~mask;
	}
}

fn getFeatArray(index: u32, minLevel: u32) -> array<f32, 16> {
	// empty array 
	var featArray = array<f32, 16>(0.0, 0.0, 0.0, 0.0, 
		0.0, 0.0, 0.0, 0.0, 
		0.0, 0.0, 0.0, 0.0, 
		0.0, 0.0, 0.0, 0.0);
	for (var i = 0u; i < 16u; i = i + 1u) {
		// TODO get value from level to index
		if (i32(minLevel) + i32(i) > i32(index)-i32(minLevel)) {
			break;
		};
		let address = u32(traversal[minLevel + i].address0);
		featArray[i] = getValue0(getNode0(address));
	};
	return normalizeArray16(featArray);
}
// distance between two vectors
fn distance(a: array<f32, 16>, b: array<f32, 16>) -> f32 {
	var dist = 0.0;
	for (var i = 0u; i < 16u; i = i + 1u) {
		let diff = a[i] - b[i];
		dist += diff * diff;
	}
	return sqrt(dist);
}


fn orderChildren(children: vec4<f32>, level: u32, parentArray: array<f32, 16>) -> array<u32, 4u> {
	let reference = threadIterations.reference;
	
	var childArray1 = parentArray;
	childArray1[level] = getValue0(getNode0(u32(children[0u])));
	childArray1 = normalizeArray16(childArray1);
	var childArray2 = parentArray;
	childArray2[level] = getValue0(getNode0(u32(children[1u])));
	childArray2 = normalizeArray16(childArray2);
	var childArray3 = parentArray;
	childArray3[level] = getValue0(getNode0(u32(children[2u])));
	childArray3 = normalizeArray16(childArray3);
	var childArray4 = parentArray;
	childArray4[level] = getValue0(getNode0(u32(children[3u])));
	childArray4 = normalizeArray16(childArray4);


	/*
	let childValues = vec4<f32>(childArray1[level] - reference[level],
		childArray2[level] - reference[level], 
		childArray3[level] - reference[level], 
		childArray4[level] - reference[level]);
	*/
	let childValues = vec4<f32>(distance(childArray1, reference), 
		distance(childArray2, reference), 
		distance(childArray3, reference), 
		distance(childArray4, reference));

	var sortedIndices = array<u32, 4u>(0u, 1u, 2u, 3u);
	for (var i = 0u; i < 4u; i = i + 1u) {
		for (var j = i + 1u; j < 4u; j = j + 1u) {
			if (childValues[i] > childValues[j]) {
				let temp = sortedIndices[i];
				sortedIndices[i] = sortedIndices[j];
				sortedIndices[j] = temp;
			}
		}
	}
	return sortedIndices;
}

@group(0) @binding(0) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(1) var<storage, read_write> quadMap: BitArray; 
//@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;

@group(0) @binding(2) var texture: texture_storage_2d<rgba8unorm, write>;
//@group(1) @binding(0) var<storage, read> levelValues: array<array<f32, 16>>;
@group(1) @binding(0) var<storage, read_write> threadIterations: ThreadInfo; 

@group(2) @binding(0) var<storage, read_write> values0: array<f32>;
@group(2) @binding(1) var<storage, read_write> nodes0: array<f32>;

@group(3) @binding(0) var<storage, read_write> values1: array<f32>;
@group(3) @binding(1) var<storage, read_write> nodes1: array<f32>;

//@compute @workgroup_size(1)
//const local_size: u32 = 1u;
//const local_size: u32 = 2u;
//const local_size: u32 = 4u;
const local_size: u32 = 8u;
//const local_size: u32 = 16u;
//@compute @workgroup_size(1)
//@compute @workgroup_size(2,2)
//@compute @workgroup_size(4,4)
@compute @workgroup_size(8,8)
//@compute @workgroup_size(16,16)
	fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
			@builtin(workgroup_id) workgroup_id : vec3<u32>,
			@builtin(num_workgroups) num_workgroups : vec3<u32>,
			@builtin(local_invocation_id) local_id: vec3<u32>) {

		let textDim = textureDimensions(texture);

		var threadDim = threadIterations.dimensions;
		if (threadDim.x == 0u && threadDim.y == 0u && threadIterations.dimensions.y == 0u) {
			// initialize thread info
			threadIterations.dimensions = textDim;
			threadDim = textDim;
		}

		let level = u32(log2(f32(textDim.x)));
		
		// TODO place into threadIterations
		let minLevel = u32(log2(f32(threadDim.x)));
		threadIterations.minLevel = minLevel;
		//let threadIndex: u32 =  (global_id.x + global_id.y * threadDim.x) + 1u;
		// TODO make 16u be replaced with accually number of levels
		let threadIndex: u32 =  ((workgroup_id.x + workgroup_id.y * threadDim.x) * local_size + (local_id.x + local_id.y * threadDim.x))*16u;


		let index: u32 = level - minLevel + 1u + threadIndex;
		
		let x = 0u;
		let y = 1u;

		var coord = traversal[index].coord;
		var pixCoord = vec2<u32>(vec2<f32>(textDim) * coord);


		let seedTrav = traversal[0u];

		//let origDim = threadIterations.dimensions;
		let origPixCoord = vec2<u32>(vec2<f32>(textDim) * seedTrav.coord);
		// Initialization of traversal
		if (textDim.x == threadDim.x) {
			//pixCoord = global_id.xy*local_size + local_id.xy;
			pixCoord = global_id.xy;
			coord = (vec2<f32>(pixCoord)) / vec2<f32>(textDim);	
			traversal[index].coord = coord;
		}



		let nodeIndex = getNodeIndex(level, pixCoord);

			
		// check if outside traversal bounds (not need for gpu)
		var addr = traversal[index].address0;
		if (level == minLevel && addr == 0.0) {
			// for loop minLevel
			for (var i = 0u; i <= minLevel; i = i + 1u) {
				let dim = u32(pow(2.0, f32(i)));
				let preQuad = quadFromCoord(coord, vec2<u32>(dim, dim)); 
				if (addr == -1) {
					continue;
				}
				addr = getNode0(u32(addr)).children[preQuad];
			}
			traversal[index].address0 = addr;
		}

		if (pixCoord.y == origPixCoord.y && pixCoord.x == origPixCoord.x && !get_bit(nodeIndex)) {
			//let color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
			//textureStore(texture, pixCoord, color);

			let nextQuad = quadFromCoord(coord, textDim*2u);
			let node = getNode0(u32(addr));
			let childAddress = node.children[nextQuad];
			let quadCoord = vec2<u32>(nextQuad / 2u, nextQuad % 2u);
			let childPixCoord = 2u*pixCoord+quadCoord;
			let childNodeIndex = getNodeIndex(level+1, childPixCoord);
			if (addr < 0.0) {
				set_bit(nodeIndex, true);
				return;
			}
			let childNode = getNode0(u32(childAddress));

			let value = getValue0(node);
			//threadIterations.reference[u32(level-minLevel)] = value;
			setReference(u32(level-minLevel), value);
			let childValue = getValue0(childNode);
			//threadIterations.reference[u32(level-minLevel)+1u] = childValue;
			setReference(u32(level-minLevel)+1u, childValue);

			traversal[index+1].address0 = childAddress;
			traversal[index+1].coord = coord;
			set_bit(nodeIndex, true);

			return;
		}
		
		let node = getNode0(u32(addr));
		var value = getValue0(node);

		// Dont process if reference is not set
		if (threadIterations.reference[u32(level-minLevel)] == 0.0) {
			return;
		}

		if (addr >= 0.0 && value >= 0.0) {
			let parRef = threadIterations.reference[u32(level-minLevel)];
			value = 1.0 - abs(parRef - value);
		}
		let nextQuad = quadFromCoord(coord, textDim*2u);
		let children = node.children;

		var child = children[nextQuad];
		var childNodeIndex = 0u;
		var childPixCoord = vec2<u32>(0u, 0u);
	
		
		// order children based on priority
		let refer = threadIterations.reference[u32(level-minLevel)+1u];
		let parentArray = getFeatArray(level, minLevel);
		let sortedIndices = orderChildren(children, level, parentArray);

		var childCoord = coord; 
		for (var j = 0u; j < 4u; j = j + 1u) {

			let q = (j + nextQuad) % 4u;
			
			child = children[q];
			let quadCoord = vec2<u32>(q / 2u, q % 2u);
			childPixCoord = 2u*pixCoord+quadCoord;

			childNodeIndex = getNodeIndex(level+1, childPixCoord);

			if (q != nextQuad){
				childCoord = vec2<f32>(f32(childPixCoord.x) / f32(textDim.x*2u), f32(childPixCoord.y) / f32(textDim.y*2u));
			}
			let childNode = getNode0(u32(child));
			
			let quadBool = get_bit(childNodeIndex); 
			//if ((quadBool && checkQuadMapLevelDone(level+1, childPixCoord, childNode)) || (values0[u32(child)] == 0.0) || child <= 0.0) {
			if ((quadBool && checkQuadMapLevelDone(level+1, childPixCoord, childNode)) || child <= 0.0) {
				var tempCoord = vec2<f32>(pixCoord)/vec2<f32>(textDim);
				let childValue = getValue0(childNode);
				// TODO switch to || statement
				//if (childValue != 0.0 && ((pixCoord.y != origPixCoord.y) && (pixCoord.x != origPixCoord.x))) {
				//if (childValue != 0.0 && ((pixCoord.y != origPixCoord.y) || (pixCoord.x != origPixCoord.x))) {
				//if (((pixCoord.y != origPixCoord.y) || (pixCoord.x != origPixCoord.x))) {
				writeTexture(tempCoord, value, level, global_id, local_id);
				//}
				set_bit(childNodeIndex, true);
				continue;
			}
			break;
		}
		set_bit(childNodeIndex, true);
		//quadMap[childNodeIndex] = 1u;

		traversal[index+1].address0 = child;
		traversal[index+1].coord = childCoord;
		traversal[index].coord = childCoord;
	}
