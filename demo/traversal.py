import json
import math

JSON_FILE = "../public/data/obs/quadtree_Phylloscopus_collybita.json"
# read the JSON file
with open(JSON_FILE, "r") as file:
    raw = json.load(file)
    data = json.loads(raw)

nodes = data["nodes"]
values = data["values"]

# node structure
class Node:
    def __init__(self, valueAddr: int, children: [int], quad: int = 0): 
        self.valueAddr = valueAddr
        self.children = children
        self.quad = quad

# enumerate data by 6 at a time
node_buffer = []
for i in range(0, len(nodes), 6):
    valueAddr = nodes[i]
    children = nodes[i + 1:i + 5]
    quad = nodes[i + 5]
    node_buffer.append(Node(valueAddr, children, quad))


class Trav:
    def __init__(self, coord: [float, float], addr: int, done: int, mipLevel: int):
        self.coord = coord
        self.addr = addr
        self.done = done
        self.mipLevel = mipLevel

# calculate max mipmap level
# MAX_DIMENSION = 256
MAX_DIMENSION = 128;
MAX_DIMENSION = MAX_DIMENSION / 16
MAX_DIMENSION = MAX_DIMENSION / 2
maxMipMapLevel = int(math.log2(MAX_DIMENSION));
print("Max Mipmap Level:", maxMipMapLevel)
images: [[int]] = []
for i in range(maxMipMapLevel + 1):
    dim = pow(2, maxMipMapLevel - i)
    image = [[0 for _ in range(dim)] for _ in range(dim)]
    images.append(image)


traversal: [Trav] = []
initTrav = Trav([0.5, 0.6], 0, 1, maxMipMapLevel)
traversal.append(initTrav)
# append 10 empty traversal
for i in range(maxMipMapLevel):
    empty_traversal = Trav([0, 0], 0, 0, maxMipMapLevel - i - 1)
    traversal.append(empty_traversal)

def getNodeIndex(index: int, quad: int) -> int:
    # Calculate the node index of a flatt quadtree
    return pow(4, index) + quad

def quadFromCoord(coord: [float, float], textDim: [int, int]) -> int:
    if(textDim[0] == 1 and textDim[1] == 1):
        return 0
    pixCoord = [int(coord[0] * textDim[0]), int(coord[1] * textDim[1])]
    quadCoord = [pixCoord[0] % 2, pixCoord[1] % 2]
    quad = quadCoord[0] * 2 + quadCoord[1]
    return quad

def colorImage(uv: [float, float], mipLevel: int):
    # print("Coloring")
    image = images[mipLevel] 
    dim = len(image)
    print(uv)
    x = int(uv[0] * dim - 1)
    y = int(uv[1] * dim - 1)
    print(x, y)
    image[y][x] = 1;
    print(image)

# size of each mipmap level for quadtree
quadTreeSize = math.pow(4, maxMipMapLevel + 1);
quadMap: [bool] = [False] * int(quadTreeSize)
print("Quad Map Size:", len(quadMap))

for i, trav in enumerate(traversal):
    # print("Node", i)
    dim = pow(2, maxMipMapLevel - trav.mipLevel)
    # print("dim:", dim)
    index = int(math.log2(dim));
    # print("index:", index)
    textDim = [dim, dim]
    coord = trav.coord
    # print("coord:", coord)
    quad = quadFromCoord(coord, textDim)
    # print("quad:", quad)
    nodeIndex = getNodeIndex(index, quad)
    # print("nodeIndex",nodeIndex)

    colorImage(coord, index)

    if (i < len(traversal) - 1):
        traversal[i+1].coord = coord;


import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np
# print all images above eachother like a mipmaplevel in 3D plot
fig = plt.figure(figsize=(10, 10))
ax = fig.add_subplot(111, projection='3d')
for i, image in enumerate(images):
    dim = len(image)
    x = np.linspace(-1, 1, dim+1)
    # x = [j / (dim) for j in range(dim+1)]
    y = np.linspace(-1, 1, dim+1)
    # y = [j / (dim) for j in range(dim+1)]
    X, Y = np.meshgrid(x, y)
    Z = np.ones_like(X) * i  # Mipmap level as Z value
    
    norm_image = (image - np.min(image)) / (np.max(image) - np.min(image) + 1e-8)
    
    # Convert to RGBA format
    rgba_image = plt.cm.gray(norm_image)
    # set alpha
    rgba_image[..., -1] = 0.8 

    # z = [i] * (dim * dim)
    # c = [image[j][k] for j in range(dim) for k in range(dim)]

    ax.plot_surface(X, Y, Z, rstride=1, cstride=1, facecolors=rgba_image, shade=False)


    # print max and min x/y

pn = np.array([traversal[0].coord[0], traversal[0].coord[1]])
pn = pn * 2 - 1  # Normalize to [-1, 1]
p0 = np.array([pn[0], pn[1], 0])  # Start point at mipmap level 0
p1 = np.array([pn[0], pn[1], maxMipMapLevel])  # End point at max mipmap level
# plot as line between the points
ax.plot([p0[0], p1[0]], [p0[1], p1[1]], [p0[2], p1[2]], color='red', linewidth=2, label='Traversal Path')


ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('MipMap Level')
# scale the z-axis to show the mipmap levels
ax.set_zlim(0, maxMipMapLevel)
plt.title('3D Mipmap Levels')
plt.show()

