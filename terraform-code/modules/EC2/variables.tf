variable "instance_name" {
  default = "Group 3 - CLCM 3404 - Game Application Server"
}

variable "ami_id" {
  default = "ami-0fc5d935ebf8bc3bc"
}

variable "instance_type" {
  default = "t3a.medium"
}

variable "key_name" {
  default = "Group-3-CLCM-3404-Project-Game-Application-Server"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_id" {
  type = string
}
